import { describe, expect, it } from "vitest";
import { toEnglishSpeech } from "./services/chat";

describe("toEnglishSpeech (speech text preparation)", () => {
  it("returns the FULL Arabic reply cleaned of markdown (no translation, no summarizing)", async () => {
    const spoken = await toEnglishSpeech(
      "**سعر الذهب** الآن *4070* دولاراً للأونصة بارتفاع 0.5% اليوم، والاتجاه العام هابط."
    );
    expect(spoken.length).toBeGreaterThan(20);
    // Must remain Arabic (spoken in Arabic now)
    expect(/[\u0600-\u06FF]/.test(spoken)).toBe(true);
    // Markdown symbols stripped
    expect(spoken).not.toContain("*");
    // Preserves the key figure and the full content
    expect(spoken).toContain("4070");
    expect(spoken).toContain("هابط");
  });

  it("strips links and list bullets while keeping their text", async () => {
    const spoken = await toEnglishSpeech("- نقطة أولى\n- [رابط](https://x.com) مهم\n# عنوان");
    expect(spoken).not.toContain("](");
    expect(spoken).not.toContain("#");
    expect(spoken).toContain("رابط");
    expect(spoken).toContain("نقطة أولى");
  });
});
