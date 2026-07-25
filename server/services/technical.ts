/**
 * Technical analysis: SMA/EMA, RSI, support/resistance and rule-based signals
 * with Arabic explanations.
 */
import type { Candle } from "./goldData";

// ---------- indicators ----------
export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += values[j];
      prev = sum / period;
      out[i] = prev;
    } else if (prev != null) {
      prev = values[i] * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period + 1) return out;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

// ---------- support / resistance ----------
export type Level = { price: number; type: "support" | "resistance"; strength: number };

/** Find swing highs/lows and cluster them into levels. */
export function findLevels(candles: Candle[], lookback = 120): Level[] {
  const data = candles.slice(-lookback);
  if (data.length < 10) return [];
  const pivots: { price: number; kind: "high" | "low" }[] = [];
  const w = 3;
  for (let i = w; i < data.length - w; i++) {
    const isHigh = data.slice(i - w, i + w + 1).every(c => c.high <= data[i].high);
    const isLow = data.slice(i - w, i + w + 1).every(c => c.low >= data[i].low);
    if (isHigh) pivots.push({ price: data[i].high, kind: "high" });
    if (isLow) pivots.push({ price: data[i].low, kind: "low" });
  }
  const currentPrice = data[data.length - 1].close;
  const tolerance = currentPrice * 0.004;
  const clusters: { sum: number; count: number; kind: "high" | "low" }[] = [];
  for (const p of pivots) {
    const c = clusters.find(
      cl => Math.abs(cl.sum / cl.count - p.price) < tolerance && cl.kind === p.kind
    );
    if (c) {
      c.sum += p.price;
      c.count++;
    } else {
      clusters.push({ sum: p.price, count: 1, kind: p.kind });
    }
  }
  return clusters
    .map(c => {
      const price = c.sum / c.count;
      return {
        price,
        type: (price < currentPrice ? "support" : "resistance") as Level["type"],
        strength: c.count,
      };
    })
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 6)
    .sort((a, b) => a.price - b.price);
}

// ---------- signals ----------
export type Signal = {
  id: string;
  type: "buy" | "sell" | "neutral";
  title: string;
  reason: string;
  strength: "قوية" | "متوسطة" | "ضعيفة";
};

export type TechnicalSummary = {
  timeframe: string;
  price: number;
  sma20: number | null;
  sma50: number | null;
  ema9: number | null;
  rsi14: number | null;
  levels: Level[];
  signals: Signal[];
  bias: "صاعد" | "هابط" | "محايد";
};

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });

export function analyze(candles: Candle[], timeframe: string): TechnicalSummary {
  const closes = candles.map(c => c.close);
  const price = closes[closes.length - 1] ?? 0;
  const sma20Arr = sma(closes, 20);
  const sma50Arr = sma(closes, 50);
  const ema9Arr = ema(closes, 9);
  const rsiArr = rsi(closes, 14);

  const last = closes.length - 1;
  const sma20v = sma20Arr[last];
  const sma50v = sma50Arr[last];
  const ema9v = ema9Arr[last];
  const rsiV = rsiArr[last];
  const levels = findLevels(candles);

  const signals: Signal[] = [];

  // 1) MA cross (sma20 vs sma50) — check recent cross within last 5 bars
  if (sma20v != null && sma50v != null) {
    let crossIdx = -1;
    let crossDir: "up" | "down" | null = null;
    for (let i = Math.max(1, last - 5); i <= last; i++) {
      const a20 = sma20Arr[i - 1], b20 = sma20Arr[i];
      const a50 = sma50Arr[i - 1], b50 = sma50Arr[i];
      if (a20 == null || b20 == null || a50 == null || b50 == null) continue;
      if (a20 <= a50 && b20 > b50) { crossIdx = i; crossDir = "up"; }
      if (a20 >= a50 && b20 < b50) { crossIdx = i; crossDir = "down"; }
    }
    if (crossDir === "up") {
      signals.push({
        id: "ma-cross",
        type: "buy",
        title: "تقاطع ذهبي للمتوسطات",
        reason: `المتوسط المتحرك 20 اخترق المتوسط 50 صعوداً قبل ${last - crossIdx} شمعة، وهذا نمط كلاسيكي يشير إلى بداية زخم صاعد.`,
        strength: "قوية",
      });
    } else if (crossDir === "down") {
      signals.push({
        id: "ma-cross",
        type: "sell",
        title: "تقاطع سلبي للمتوسطات",
        reason: `المتوسط المتحرك 20 كسر المتوسط 50 هبوطاً قبل ${last - crossIdx} شمعة، مما يشير إلى ضغط بيعي وتحول محتمل في الاتجاه.`,
        strength: "قوية",
      });
    } else {
      const above = sma20v > sma50v;
      signals.push({
        id: "ma-trend",
        type: above ? "buy" : "sell",
        title: above ? "ترتيب صاعد للمتوسطات" : "ترتيب هابط للمتوسطات",
        reason: above
          ? `المتوسط 20 (${fmt(sma20v)}) فوق المتوسط 50 (${fmt(sma50v)})، والسعر ${price > sma20v ? "فوقهما معاً مما يعزز" : "تحت المتوسط 20 مما يضعف"} الاتجاه الصاعد.`
          : `المتوسط 20 (${fmt(sma20v)}) تحت المتوسط 50 (${fmt(sma50v)})، والسعر ${price < sma20v ? "تحتهما معاً مما يعزز" : "فوق المتوسط 20 مما يخفف"} الضغط الهابط.`,
        strength: "متوسطة",
      });
    }
  }

  // 2) RSI
  if (rsiV != null) {
    if (rsiV >= 70) {
      signals.push({
        id: "rsi",
        type: "sell",
        title: `تشبع شرائي (RSI ${fmt(rsiV)})`,
        reason: `مؤشر القوة النسبية وصل ${fmt(rsiV)} فوق مستوى 70، مما يعني أن الصعود الحالي مبالغ فيه وقد يشهد تصحيحاً أو جني أرباح قريباً.`,
        strength: rsiV >= 80 ? "قوية" : "متوسطة",
      });
    } else if (rsiV <= 30) {
      signals.push({
        id: "rsi",
        type: "buy",
        title: `تشبع بيعي (RSI ${fmt(rsiV)})`,
        reason: `مؤشر القوة النسبية انخفض إلى ${fmt(rsiV)} تحت مستوى 30، مما يعني أن البيع مبالغ فيه وقد يحدث ارتداد صاعد قريباً.`,
        strength: rsiV <= 20 ? "قوية" : "متوسطة",
      });
    } else {
      signals.push({
        id: "rsi",
        type: "neutral",
        title: `RSI في المنطقة المحايدة (${fmt(rsiV)})`,
        reason: `مؤشر القوة النسبية عند ${fmt(rsiV)} بين 30 و70، أي لا يوجد تشبع شرائي أو بيعي، والسوق ${rsiV > 55 ? "يميل للقوة الشرائية" : rsiV < 45 ? "يميل للضغط البيعي" : "متوازن حالياً"}.`,
        strength: "ضعيفة",
      });
    }
  }

  // 3) Support/Resistance proximity
  const nearest = levels
    .map(lv => ({ ...lv, dist: Math.abs(lv.price - price) / price }))
    .sort((a, b) => a.dist - b.dist)[0];
  if (nearest && nearest.dist < 0.01) {
    if (nearest.type === "support") {
      signals.push({
        id: "level",
        type: "buy",
        title: `السعر قرب دعم ${fmt(nearest.price)}`,
        reason: `السعر الحالي (${fmt(price)}) يقترب من مستوى دعم تاريخي عند ${fmt(nearest.price)} تم اختباره ${nearest.strength} مرات. الدعوم القوية غالباً تشهد ارتدادات صاعدة، مع مراقبة كسر المستوى كإشارة عكسية.`,
        strength: nearest.strength >= 3 ? "قوية" : "متوسطة",
      });
    } else {
      signals.push({
        id: "level",
        type: "sell",
        title: `السعر قرب مقاومة ${fmt(nearest.price)}`,
        reason: `السعر الحالي (${fmt(price)}) يقترب من مستوى مقاومة تاريخي عند ${fmt(nearest.price)} تم اختباره ${nearest.strength} مرات. المقاومات القوية غالباً تصد السعر، واختراقها بثبات يعتبر إشارة قوة.`,
        strength: nearest.strength >= 3 ? "قوية" : "متوسطة",
      });
    }
  }

  // bias
  const buyScore = signals.filter(s => s.type === "buy").reduce((s, sig) => s + (sig.strength === "قوية" ? 2 : sig.strength === "متوسطة" ? 1 : 0.5), 0);
  const sellScore = signals.filter(s => s.type === "sell").reduce((s, sig) => s + (sig.strength === "قوية" ? 2 : sig.strength === "متوسطة" ? 1 : 0.5), 0);
  const bias: TechnicalSummary["bias"] =
    buyScore > sellScore + 0.5 ? "صاعد" : sellScore > buyScore + 0.5 ? "هابط" : "محايد";

  return {
    timeframe,
    price,
    sma20: sma20v,
    sma50: sma50v,
    ema9: ema9v,
    rsi14: rsiV,
    levels,
    signals,
    bias,
  };
}

/** Compute full indicator series for charting. */
export function indicatorSeries(candles: Candle[]) {
  const closes = candles.map(c => c.close);
  return {
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    ema9: ema(closes, 9),
    rsi14: rsi(closes, 14),
  };
}

