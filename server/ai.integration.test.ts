import { describe, expect, it } from "vitest";
import { chatWithJarvis } from "./services/chat";
import { getDailyAnalysis } from "./services/aiAnalysis";

describe("ai.chat (live LLM + live data)", () => {
  it("answers a general question in Arabic without tools", async () => {
    const reply = await chatWithJarvis([
      { role: "user", content: "من أنت؟ عرّف نفسك بجملة واحدة." },
    ]);
    expect(reply.length).toBeGreaterThan(5);
    // Should contain Arabic characters
    expect(/[\u0600-\u06FF]/.test(reply)).toBe(true);
  }, 60000);

  it("fetches live data for an asset question (Apple stock)", async () => {
    const reply = await chatWithJarvis([
      { role: "user", content: "كم سعر سهم آبل الآن؟" },
    ]);
    expect(/[\u0600-\u06FF]/.test(reply)).toBe(true);
    // Should contain a number (the live price)
    expect(/\d/.test(reply)).toBe(true);
  }, 90000);
});

describe("ai.dailyAnalysis (live LLM)", () => {
  it("generates Arabic analysis with factors and outlook", async () => {
    const analysis = await getDailyAnalysis(true);
    expect(analysis.summary.length).toBeGreaterThan(30);
    expect(/[\u0600-\u06FF]/.test(analysis.summary)).toBe(true);
    expect(analysis.factors.length).toBeGreaterThan(0);
    for (const f of analysis.factors) {
      expect(["إيجابي", "سلبي", "محايد"]).toContain(f.impact);
    }
    expect(analysis.outlook.length).toBeGreaterThan(20);
    expect(analysis.generatedAt).toBeGreaterThan(0);
  }, 120000);
});

