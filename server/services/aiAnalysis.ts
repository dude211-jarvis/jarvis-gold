/**
 * AI-powered Arabic market analysis for gold, using the USER'S OWN
 * Gemini API key with live market context data.
 */
import { geminiGenerate } from "./gemini";
import { getGoldQuote, getGoldCandles, getMarketContext, type Quote } from "./goldData";
import { analyze } from "./technical";

let analysisCache: { data: AnalysisResult; expires: number } | null = null;

export type AnalysisResult = {
  summary: string;
  factors: { title: string; impact: "إيجابي" | "سلبي" | "محايد"; detail: string }[];
  outlook: string;
  generatedAt: number;
};

function fmtQuote(label: string, q: Quote | null): string {
  if (!q) return `${label}: غير متاح`;
  return `${label}: ${q.price.toFixed(2)} (${q.changePercent >= 0 ? "+" : ""}${q.changePercent.toFixed(2)}%)`;
}

export async function getDailyAnalysis(force = false): Promise<AnalysisResult> {
  if (!force && analysisCache && analysisCache.expires > Date.now()) {
    return analysisCache.data;
  }

  const [quote, dailyCandles, ctx] = await Promise.all([
    getGoldQuote(),
    getGoldCandles("1d"),
    getMarketContext(),
  ]);
  const tech = analyze(dailyCandles, "1d");

  const contextText = [
    `سعر الذهب الحالي: $${quote.price.toFixed(2)} للأونصة`,
    `التغير اليومي: ${quote.change.toFixed(2)} (${quote.changePercent.toFixed(2)}%)`,
    `أعلى/أدنى اليوم: ${quote.dayHigh.toFixed(2)} / ${quote.dayLow.toFixed(2)}`,
    `الاتجاه الفني اليومي: ${tech.bias} | RSI: ${tech.rsi14?.toFixed(1) ?? "NA"} | SMA20: ${tech.sma20?.toFixed(1) ?? "NA"} | SMA50: ${tech.sma50?.toFixed(1) ?? "NA"}`,
    fmtQuote("مؤشر الدولار DXY", ctx.dxy),
    fmtQuote("عائد السندات الأمريكية 10 سنوات", ctx.us10y),
    fmtQuote("النفط الخام WTI", ctx.oil),
    fmtQuote("الفضة", ctx.silver),
    fmtQuote("مؤشر S&P 500", ctx.sp500),
    fmtQuote("بيتكوين", ctx.bitcoin),
  ].join("\n");

  const result = await geminiGenerate({
    systemInstruction:
      "أنت محلل أسواق مالية محترف متخصص في الذهب. اكتب بالعربية الفصحى الواضحة. حلل البيانات المعطاة فقط دون اختلاق أرقام. لا تقدم نصيحة استثمارية مباشرة، بل تحليلاً موضوعياً.",
    messages: [
      {
        role: "user",
        parts: [
          {
            text: `هذه بيانات السوق الحية الآن:\n${contextText}\n\nاكتب تحليلاً يومياً لسوق الذهب يشمل:\n1. ملخص وضع السوق (فقرة واحدة)\n2. العوامل المؤثرة (الدولار، أسعار الفائدة/السندات، المعنويات العامة) وتأثير كل عامل\n3. النظرة العامة القادمة (فقرة قصيرة)`,
          },
        ],
      },
    ],
    maxOutputTokens: 4000,
    responseSchema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "ملخص وضع سوق الذهب بالعربية" },
        factors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              impact: { type: "string", enum: ["إيجابي", "سلبي", "محايد"] },
              detail: { type: "string" },
            },
            required: ["title", "impact", "detail"],
          },
        },
        outlook: { type: "string", description: "النظرة المستقبلية بالعربية" },
      },
      required: ["summary", "factors", "outlook"],
    },
  });

  const parsed = JSON.parse(result.text) as Omit<AnalysisResult, "generatedAt">;

  const data: AnalysisResult = { ...parsed, generatedAt: Date.now() };
  analysisCache = { data, expires: Date.now() + 30 * 60 * 1000 }; // 30 min
  return data;
}
