import { describe, expect, it } from "vitest";
import { sma, ema, rsi, analyze, findLevels } from "./services/technical";
import type { Candle } from "./services/goldData";

function makeCandles(closes: number[]): Candle[] {
  return closes.map((c, i) => ({
    time: 1700000000 + i * 3600,
    open: c - 1,
    high: c + 2,
    low: c - 2,
    close: c,
    volume: 1000,
  }));
}

describe("technical indicators", () => {
  it("computes SMA correctly", () => {
    const values = [1, 2, 3, 4, 5];
    const out = sma(values, 3);
    expect(out[0]).toBeNull();
    expect(out[1]).toBeNull();
    expect(out[2]).toBeCloseTo(2);
    expect(out[3]).toBeCloseTo(3);
    expect(out[4]).toBeCloseTo(4);
  });

  it("computes EMA with seed SMA", () => {
    const values = [10, 10, 10, 10, 20];
    const out = ema(values, 3);
    expect(out[2]).toBeCloseTo(10);
    expect(out[4]).toBeGreaterThan(10);
  });

  it("computes RSI in 0-100 range and high for uptrend", () => {
    const rising = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
    const out = rsi(rising, 14);
    const last = out[out.length - 1];
    expect(last).not.toBeNull();
    expect(last!).toBeGreaterThan(70);
    expect(last!).toBeLessThanOrEqual(100);
  });

  it("RSI low for downtrend", () => {
    const falling = Array.from({ length: 30 }, (_, i) => 200 - i * 2);
    const out = rsi(falling, 14);
    const last = out[out.length - 1];
    expect(last!).toBeLessThan(30);
  });

  it("analyze produces Arabic signals and a bias", () => {
    const closes = Array.from({ length: 80 }, (_, i) => 4000 + Math.sin(i / 5) * 30 + i);
    const summary = analyze(makeCandles(closes), "1h");
    expect(summary.signals.length).toBeGreaterThan(0);
    expect(["صاعد", "هابط", "محايد"]).toContain(summary.bias);
    for (const s of summary.signals) {
      expect(s.reason.length).toBeGreaterThan(10);
      expect(["buy", "sell", "neutral"]).toContain(s.type);
    }
  });

  it("findLevels returns sorted support/resistance", () => {
    const closes = Array.from({ length: 120 }, (_, i) => 4000 + Math.sin(i / 8) * 50);
    const levels = findLevels(makeCandles(closes));
    expect(levels.length).toBeGreaterThan(0);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i].price).toBeGreaterThanOrEqual(levels[i - 1].price);
    }
  });
});
