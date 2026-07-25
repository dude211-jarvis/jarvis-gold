/**
 * Direct Google Gemini API client using the USER'S OWN API key (GEMINI_API_KEY).
 * All AI usage bills to the user's Google account — not Manus credits.
 *
 * Includes API-health tracking so the UI can alert the user when the key
 * fails (invalid/expired/quota exhausted).
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
// Primary + fallback models. `gemini-flash-latest` maps to gemini-3.6-flash
// whose free tier is only 20 req/day — too small. gemini-3.5-flash has a
// much larger free quota; flash-lite is the emergency fallback.
const MODELS = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-flash-lite-latest"];

export type GeminiMessage = {
  role: "user" | "model";
  parts: Array<
    | { text: string }
    | { functionCall: { name: string; args: Record<string, unknown> }; thoughtSignature?: string }
    | { functionResponse: { name: string; response: Record<string, unknown> } }
  >;
};

export type GeminiTool = {
  functionDeclarations: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
};

export type GeminiResult = {
  text: string;
  functionCalls: Array<{ name: string; args: Record<string, unknown>; thoughtSignature?: string }>;
};

// ---------- API health status (for user alerts) ----------
export type ApiHealth = {
  ok: boolean;
  status: "ok" | "quota_exhausted" | "rate_limited" | "invalid_key" | "error";
  message: string;
  lastChecked: number;
};

let apiHealth: ApiHealth = { ok: true, status: "ok", message: "", lastChecked: 0 };

export function getApiHealth(): ApiHealth {
  return apiHealth;
}

function setHealth(status: ApiHealth["status"], message: string) {
  apiHealth = { ok: status === "ok", status, message, lastChecked: Date.now() };
}

export class GeminiApiError extends Error {
  retryAfterSec?: number;
  constructor(
    message: string,
    public status: ApiHealth["status"]
  ) {
    super(message);
  }
}

function classifyError(httpStatus: number, body: string): GeminiApiError {
  if (httpStatus === 429 || body.includes("RESOURCE_EXHAUSTED") || body.includes("quota")) {
    // Per-minute rate limit (free tier) → temporary, retryable
    const retryMatch = body.match(/retry in ([\d.]+)s/i);
    if (retryMatch) {
      const secs = Math.ceil(parseFloat(retryMatch[1]));
      const err = new GeminiApiError(
        `ضغط مؤقت على مفتاح Gemini (حد الطلبات في الدقيقة). أعد المحاولة بعد ${secs} ثانية.`,
        "rate_limited"
      );
      err.retryAfterSec = secs;
      return err;
    }
    return new GeminiApiError(
      "تم استنفاد حصة مفتاح Gemini API (الطبقة المجانية أو الرصيد). راجع حسابك في Google AI Studio.",
      "quota_exhausted"
    );
  }
  if (httpStatus === 400 || httpStatus === 401 || httpStatus === 403) {
    return new GeminiApiError(
      "مفتاح Gemini API غير صالح أو منتهي. أنشئ مفتاحاً جديداً من Google AI Studio.",
      "invalid_key"
    );
  }
  return new GeminiApiError(`خطأ من خدمة Gemini (HTTP ${httpStatus})`, "error");
}

/**
 * Call Gemini generateContent with the user's key.
 * Updates apiHealth on success/failure so the UI can alert the owner.
 */
export async function geminiGenerate(opts: {
  systemInstruction?: string;
  messages: GeminiMessage[];
  tools?: GeminiTool[];
  maxOutputTokens?: number;
  temperature?: number;
  /** When set, forces JSON output matching this schema. */
  responseSchema?: Record<string, unknown>;
}): Promise<GeminiResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    setHealth("invalid_key", "لم يتم ضبط مفتاح GEMINI_API_KEY");
    throw new GeminiApiError("مفتاح Gemini API غير مضبوط", "invalid_key");
  }

  const payload: Record<string, unknown> = {
    contents: opts.messages,
    generationConfig: {
      maxOutputTokens: opts.maxOutputTokens ?? 2048,
      temperature: opts.temperature ?? 0.7,
      ...(opts.responseSchema
        ? { responseMimeType: "application/json", responseSchema: opts.responseSchema }
        : {}),
    },
  };
  if (opts.systemInstruction) {
    payload.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }
  if (opts.tools && opts.tools.length > 0) {
    payload.tools = opts.tools;
  }

  let resp: Response | null = null;
  let lastErr: GeminiApiError | null = null;

  // Try each model in order; on quota/rate-limit move to the next.
  outer: for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        resp = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key,
          },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        setHealth("error", "تعذر الاتصال بخدمة Gemini");
        throw new GeminiApiError(`فشل الاتصال بـ Gemini: ${String(e)}`, "error");
      }

      if (resp.ok) break outer;

      const body = await resp.text().catch(() => "");
      const err = classifyError(resp.status, body);
      lastErr = err;

      // Short per-minute rate limit → wait once then retry same model
      if (attempt === 0 && err.status === "rate_limited" && (err.retryAfterSec ?? 99) <= 15) {
        await new Promise(r => setTimeout(r, ((err.retryAfterSec ?? 10) + 1) * 1000));
        continue;
      }
      // Quota/rate issues → try next model; other errors → fail now
      if (err.status === "quota_exhausted" || err.status === "rate_limited") {
        break; // next model
      }
      setHealth(err.status, err.message);
      throw err;
    }
  }

  if (!resp || !resp.ok) {
    const err = lastErr ?? new GeminiApiError("خطأ غير متوقع من خدمة Gemini", "error");
    setHealth(err.status, err.message);
    throw err;
  }

  setHealth("ok", "");

  const data = (await resp.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          functionCall?: { name: string; args: Record<string, unknown> };
          thoughtSignature?: string;
        }>;
      };
    }>;
  };

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map(p => p.text ?? "")
    .join("")
    .trim();
  const functionCalls = parts
    .filter(p => p.functionCall)
    .map(p => ({ ...p.functionCall!, thoughtSignature: p.thoughtSignature })) as GeminiResult["functionCalls"];

  return { text, functionCalls };
}

// ---------- Premium TTS (Algenib voice) ----------
const TTS_MODELS = ["gemini-2.5-flash-preview-tts"];
const TTS_VOICE = "Algenib"; // chosen by the user (deep, gravelly, commanding)

/** Wrap raw 24kHz 16-bit mono PCM in a WAV header. */
function pcmToWav(pcm: Buffer, rate = 24000): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/**
 * Generate speech audio (WAV base64) for the given English text using the
 * user's own Gemini key. Throws GeminiApiError on quota/other failures so the
 * client can fall back to browser speechSynthesis.
 */
export async function geminiTts(text: string): Promise<{ audioBase64: string; mimeType: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiApiError("مفتاح Gemini API غير مضبوط", "invalid_key");

  const payload = {
    contents: [
      {
        parts: [
          {
            text: `اقرأ النص التالي بالعربية الفصحى بنبرة هادئة راقية واثقة كمساعد ذكي وفيّ (بأسلوب جارفس)، بوضوح وسرعة طبيعية، وانطق الأرقام بالعربية: ${text}`,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } } },
    },
  };

  let lastErr: GeminiApiError | null = null;
  for (const model of TTS_MODELS) {
    let resp: Response;
    try {
      resp = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      throw new GeminiApiError(`فشل الاتصال بـ Gemini TTS: ${String(e)}`, "error");
    }
    if (resp.ok) {
      const data = (await resp.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }>;
      };
      const b64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!b64) throw new GeminiApiError("لم يُرجع Gemini TTS أي صوت", "error");
      const wav = pcmToWav(Buffer.from(b64, "base64"));
      return { audioBase64: wav.toString("base64"), mimeType: "audio/wav" };
    }
    const body = await resp.text().catch(() => "");
    lastErr = classifyError(resp.status, body);
  }
  throw lastErr ?? new GeminiApiError("خطأ غير متوقع من Gemini TTS", "error");
}
