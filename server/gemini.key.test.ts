import { describe, expect, it } from "vitest";
import { geminiGenerate, getApiHealth } from "./services/gemini";

describe("user Gemini API key validation (live)", () => {
  it("generates text with the user's key and reports healthy status", async () => {
    const res = await geminiGenerate({
      messages: [{ role: "user", parts: [{ text: "Say OK in one word." }] }],
      // gemini-flash-latest spends tokens on internal thinking; a tiny cap
      // yields an empty text. Keep it comfortable.
      maxOutputTokens: 1024,
      temperature: 0,
    });
    expect(res.text.length).toBeGreaterThan(0);
    expect(getApiHealth().ok).toBe(true);
  }, 30_000);
});
