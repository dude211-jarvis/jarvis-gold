/**
 * Gold market data service.
 * Fetches XAU/USD (GC=F futures) data DIRECTLY from Yahoo Finance's free
 * public chart API (no Manus Data API — zero credit usage),
 * with in-memory caching to avoid rate limits.
 */

const YF_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const YF_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json",
};

export type Candle = {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Quote = {
  symbol: string;
  name: string;
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  currency: string;
  marketTime: number;
};

export type Timeframe = "1h" | "4h" | "1d";

type ChartMeta = {
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  shortName?: string;
  currency?: string;
  regularMarketTime?: number;
  symbol?: string;
};

type ChartResult = {
  meta: ChartMeta;
  timestamp?: number[];
  indicators: {
    quote: Array<{
      open: (number | null)[];
      high: (number | null)[];
      low: (number | null)[];
      close: (number | null)[];
      volume: (number | null)[];
    }>;
  };
};

type ChartResponse = {
  chart: { result: ChartResult[] | null; error: unknown };
};

// ---------- cache ----------
const cache = new Map<string, { data: unknown; expires: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) return entry.data as T;
  cache.delete(key);
  return null;
}

function setCached(key: string, data: unknown, ttlMs: number) {
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

// ---------- fetching ----------
export const GOLD_SYMBOL = "GC=F";

async function fetchChart(
  symbol: string,
  interval: string,
  range: string
): Promise<ChartResult> {
  const key = `chart:${symbol}:${interval}:${range}`;
  const cached = getCached<ChartResult>(key);
  if (cached) return cached;

  const url = `${YF_BASE}/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includeAdjustedClose=true`;
  const httpResp = await fetch(url, { headers: YF_HEADERS });
  if (!httpResp.ok) {
    throw new Error(`Yahoo Finance request failed (${httpResp.status}) for ${symbol}`);
  }
  const resp = (await httpResp.json()) as ChartResponse;

  const result = resp?.chart?.result?.[0];
  if (!result) throw new Error(`No chart data for ${symbol}`);

  // TTL: intraday data 60s, daily 5min
  const ttl = interval === "1d" ? 5 * 60 * 1000 : 60 * 1000;
  setCached(key, result, ttl);
  return result;
}

function toCandles(result: ChartResult): Candle[] {
  const ts = result.timestamp ?? [];
  const q = result.indicators.quote[0];
  const candles: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i];
    if (o == null || h == null || l == null || c == null) continue;
    candles.push({
      time: ts[i],
      open: o,
      high: h,
      low: l,
      close: c,
      volume: q.volume[i] ?? 0,
    });
  }
  return candles;
}

/** Aggregate 1h candles into 4h candles. */
function aggregate4h(candles: Candle[]): Candle[] {
  const out: Candle[] = [];
  let bucket: Candle[] = [];
  let bucketKey = -1;
  for (const c of candles) {
    const key = Math.floor(c.time / (4 * 3600));
    if (key !== bucketKey && bucket.length > 0) {
      out.push(mergeBucket(bucket));
      bucket = [];
    }
    bucketKey = key;
    bucket.push(c);
  }
  if (bucket.length > 0) out.push(mergeBucket(bucket));
  return out;
}

function mergeBucket(bucket: Candle[]): Candle {
  return {
    time: bucket[0].time,
    open: bucket[0].open,
    high: Math.max(...bucket.map(c => c.high)),
    low: Math.min(...bucket.map(c => c.low)),
    close: bucket[bucket.length - 1].close,
    volume: bucket.reduce((s, c) => s + c.volume, 0),
  };
}

export async function getGoldQuote(): Promise<Quote> {
  const result = await fetchChart(GOLD_SYMBOL, "15m", "1d");
  const m = result.meta;
  const price = m.regularMarketPrice ?? 0;
  const prevClose = m.chartPreviousClose ?? m.previousClose ?? price;
  const change = price - prevClose;
  return {
    symbol: "XAU/USD",
    name: m.shortName ?? "Gold",
    price,
    prevClose,
    change,
    changePercent: prevClose ? (change / prevClose) * 100 : 0,
    dayHigh: m.regularMarketDayHigh ?? price,
    dayLow: m.regularMarketDayLow ?? price,
    volume: m.regularMarketVolume ?? 0,
    currency: m.currency ?? "USD",
    marketTime: m.regularMarketTime ?? Math.floor(Date.now() / 1000),
  };
}

export async function getGoldCandles(timeframe: Timeframe): Promise<Candle[]> {
  if (timeframe === "1h") {
    const result = await fetchChart(GOLD_SYMBOL, "1h", "1mo");
    return toCandles(result);
  }
  if (timeframe === "4h") {
    // Yahoo limits hourly data to ~60 days; 1mo of 1h bars → ~180 4h candles
    const result = await fetchChart(GOLD_SYMBOL, "1h", "1mo");
    return aggregate4h(toCandles(result));
  }
  const result = await fetchChart(GOLD_SYMBOL, "1d", "1y");
  return toCandles(result);
}

/** Fetch a quote for an arbitrary symbol (used by chat context). */
export async function getSymbolQuote(symbol: string): Promise<Quote | null> {
  try {
    const result = await fetchChart(symbol, "1d", "5d");
    const m = result.meta;
    const price = m.regularMarketPrice ?? 0;
    const prevClose = m.chartPreviousClose ?? m.previousClose ?? price;
    const change = price - prevClose;
    return {
      symbol: m.symbol ?? symbol,
      name: m.shortName ?? symbol,
      price,
      prevClose,
      change,
      changePercent: prevClose ? (change / prevClose) * 100 : 0,
      dayHigh: m.regularMarketDayHigh ?? price,
      dayLow: m.regularMarketDayLow ?? price,
      volume: m.regularMarketVolume ?? 0,
      currency: m.currency ?? "USD",
      marketTime: m.regularMarketTime ?? Math.floor(Date.now() / 1000),
    };
  } catch {
    return null;
  }
}

/** Related market quotes for AI analysis context (DXY, yields, oil, silver, S&P). */
export async function getMarketContext(): Promise<Record<string, Quote | null>> {
  const key = "marketContext";
  const cached = getCached<Record<string, Quote | null>>(key);
  if (cached) return cached;
  const symbols: Record<string, string> = {
    dxy: "DX-Y.NYB",
    us10y: "^TNX",
    oil: "CL=F",
    silver: "SI=F",
    sp500: "^GSPC",
    bitcoin: "BTC-USD",
  };
  // Fetch sequentially with a single retry: parallel bursts trip the
  // upstream rate limiter and yield nulls for some symbols.
  const ctx: Record<string, Quote | null> = {};
  for (const [k, s] of Object.entries(symbols)) {
    let q = await getSymbolQuote(s);
    if (!q) {
      await new Promise(r => setTimeout(r, 400));
      q = await getSymbolQuote(s);
    }
    ctx[k] = q;
  }
  setCached(key, ctx, 5 * 60 * 1000);
  return ctx;
}
