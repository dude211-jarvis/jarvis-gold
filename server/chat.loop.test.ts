import { describe, expect, it } from "vitest";
import { chatWithJarvis } from "./services/chat";

describe("chatWithJarvis loop (live)", () => {
  it("returns a recommendation for gold", async () => {
    const reply = await chatWithJarvis([
      { role: "user", content: "أعطني توصية عن الذهب الآن، وين رايح؟" },
    ]);
    console.log("REPLY:", reply.slice(0, 300));
    expect(reply).not.toContain("استغرق البحث");
    expect(reply.length).toBeGreaterThan(50);
  }, 120_000);
});
