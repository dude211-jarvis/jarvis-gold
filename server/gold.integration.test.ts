import { describe, expect, it } from "vitest";
import { getGoldQuote, getGoldCandles, getSymbolQuote } from "./services/goldData";

describe("gold data service (live API)", () => {
  it("fetches live gold quote", async () => {
    const q = await getGoldQuote();
    expect(q.price).toBeGreaterThan(1000);
    expect(q.symbol).toBe("XAU/USD");
    expect(q.dayHigh).toBeGreaterThanOrEqual(q.dayLow);
  }, 30000);

  it("fetches candles for all timeframes", async () => {
    for (const tf of ["1h", "4h", "1d"] as const) {
      const candles = await getGoldCandles(tf);
      expect(candles.length).toBeGreaterThan(50);
      const last = candles[candles.length - 1];
      expect(last.close).toBeGreaterThan(1000);
    }
  }, 60000);

  it("fetches arbitrary symbol quote (AAPL)", async () => {
    const q = await getSymbolQuote("AAPL");
    expect(q).not.toBeNull();
    expect(q!.price).toBeGreaterThan(0);
  }, 30000);
});

