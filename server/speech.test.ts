import { describe, expect, it } from "vitest";
import { toEnglishSpeech } from "./services/chat";

describe("toEnglishSpeech (live LLM)", () => {
  it("converts an Arabic reply into a spoken English briefing", async () => {
    const spoken = await toEnglishSpeech(
      "سعر الذهب الآن 4070 دولاراً للأونصة بارتفاع 0.5% اليوم، والاتجاه العام هابط."
    );
    expect(spoken.length).toBeGreaterThan(20);
    // Must be English (no Arabic characters)
    expect(/[\u0600-\u06FF]/.test(spoken)).toBe(false);
    // Should preserve the key figure
    expect(spoken).toContain("4070");
  }, 60_000);
});
