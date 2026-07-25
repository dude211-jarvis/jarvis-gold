/**
 * JARVIS chat service: Arabic financial assistant with live data lookup
 * via Gemini function-calling against YahooFinance — using the USER'S OWN
 * Gemini API key (bills to user's Google account, not Manus credits).
 */
import { geminiGenerate, type GeminiMessage, type GeminiTool } from "./gemini";
import { getSymbolQuote, getGoldQuote, getGoldCandles } from "./goldData";
import { analyze } from "./technical";

export type ChatMessage = { role: "user" | "assistant"; content: string };

const tools: GeminiTool[] = [
  {
    functionDeclarations: [
      {
        name: "get_quote",
        description:
          "جلب السعر الحي لأي أصل مالي من Yahoo Finance. أمثلة رموز: AAPL (آبل), TSLA (تسلا), 2222.SR (أرامكو), ^TASI.SR (تاسي), BTC-USD (بيتكوين), ETH-USD (إيثيريوم), CL=F (نفط), SI=F (فضة), GC=F (ذهب), EURUSD=X (يورو/دولار), ^GSPC (S&P 500), DX-Y.NYB (مؤشر الدولار)",
        parameters: {
          type: "object",
          properties: {
            symbol: { type: "string", description: "رمز الأصل بصيغة Yahoo Finance" },
          },
          required: ["symbol"],
        },
      },
      {
        name: "get_gold_technicals",
        description:
          "جلب التحليل الفني الكامل للذهب: الاتجاه العام، RSI، المتوسطات المتحركة، مستويات الدعم والمقاومة، والإشارات الفنية. استخدمها عند طلب توصية أو رأي فني عن الذهب.",
        parameters: { type: "object", properties: {} },
      },
    ],
  },
];

const SYSTEM_PROMPT = `أنت "جارفس" (J.A.R.V.I.S)، مساعد مالي ذكي ومحلل فني محترف يعمل ضمن نظام مراقبة سوق الذهب. شخصيتك: واثق، دقيق، مباشر، مع لمسة ذكاء راقية تشبه جارفس في أفلام آيرون مان. تخاطب المستخدم بـ"سيدي".

قواعد صارمة:
- أجب دائماً بالعربية الفصحى الواضحة والسهلة
- عند سؤالك عن سعر أو أداء أي أصل مالي، استخدم أداة get_quote لجلب البيانات الحية ولا تخمن الأسعار أبداً
- عند طلب توصية أو رأي فني عن الذهب، استخدم أداة get_gold_technicals ثم قدّم رأياً فنياً واضحاً وجريئاً: الاتجاه المرجح، مناطق الدخول المحتملة، مستويات الدعم والمقاومة، ووقف الخسارة المقترح — بناءً على المؤشرات الفعلية
- كن حاسماً في التحليل: قل "الاتجاه هابط والأقرب اختبار الدعم عند..." بدلاً من التعميم الفضفاض
- اختم أي توصية بجملة قصيرة: "هذا تحليل فني وليس نصيحة استثمارية مضمونة"
- إذا لم تجد الرمز، جرب صيغاً بديلة (الأسهم السعودية تنتهي بـ .SR)
- كن موجزاً: 2-4 فقرات قصيرة كحد أقصى، بأرقام دقيقة من البيانات الحية
- لا تخترع أخباراً أو أحداثاً، اعتمد على البيانات المتوفرة`;

async function execTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    if (name === "get_quote") {
      const symbol = String(args.symbol ?? "");
      const q = await getSymbolQuote(symbol);
      return q
        ? {
            symbol: q.symbol,
            name: q.name,
            price: q.price,
            change: q.change,
            changePercent: q.changePercent,
            dayHigh: q.dayHigh,
            dayLow: q.dayLow,
            volume: q.volume,
            currency: q.currency,
          }
        : { error: `لم أجد بيانات للرمز ${symbol}، جرب صيغة أخرى` };
    }
    if (name === "get_gold_technicals") {
      const candles = await getGoldCandles("1d");
      const t = analyze(candles, "1d");
      return t as unknown as Record<string, unknown>;
    }
    return { error: `أداة غير معروفة: ${name}` };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function chatWithJarvis(history: ChatMessage[]): Promise<string> {
  // Ambient context: current gold price
  let goldContext = "";
  try {
    const g = await getGoldQuote();
    goldContext = `\n\n[سياق حالي: سعر الذهب XAU/USD الآن $${g.price.toFixed(2)}، التغير اليومي ${g.changePercent.toFixed(2)}%]`;
  } catch {
    // non-fatal
  }

  const messages: GeminiMessage[] = history.map(m => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));

  // Function-calling loop (max 4 rounds)
  for (let round = 0; round < 4; round++) {
    const result = await geminiGenerate({
      systemInstruction: SYSTEM_PROMPT + goldContext,
      messages,
      tools,
      maxOutputTokens: 3000,
    });

    if (process.env.NODE_ENV !== "production") {
      console.error(
        `[chat] round=${round} text.len=${result.text.length} calls=${result.functionCalls.map(f => f.name).join(",") || "none"}`
      );
    }

    if (result.functionCalls.length === 0) {
      return result.text || "عذراً، لم أتمكن من توليد رد.";
    }

    // Append the model's function calls, then our responses
    messages.push({
      role: "model",
      parts: result.functionCalls.map(fc => ({
        functionCall: { name: fc.name, args: fc.args },
        ...(fc.thoughtSignature ? { thoughtSignature: fc.thoughtSignature } : {}),
      })),
    });
    const responses: GeminiMessage["parts"] = [];
    for (const fc of result.functionCalls) {
      const resp = await execTool(fc.name, fc.args);
      if (process.env.NODE_ENV !== "production") {
        console.error(`[chat] tool ${fc.name}(${JSON.stringify(fc.args)}) → ${JSON.stringify(resp).slice(0, 150)}`);
      }
      responses.push({ functionResponse: { name: fc.name, response: resp } });
    }
    messages.push({ role: "user", parts: responses });
  }

  return "عذراً، استغرق البحث وقتاً طويلاً. حاول مرة أخرى.";
}

/**
 * Prepare an Arabic assistant reply for TTS: strip markdown symbols locally
 * (no LLM call, no summarizing, no translation) so the JARVIS voice speaks
 * the FULL reply in Arabic exactly as written.
 */
export async function toEnglishSpeech(arabicText: string): Promise<string> {
  const cleaned = arabicText
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_#>`~|]+/g, " ")
    .replace(/^\s*[-•]\s*/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return cleaned || arabicText.trim();
}
