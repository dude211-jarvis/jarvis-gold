/**
 * Interactive gold chart: 1H/4H/1D tabs, price line + SMA20/SMA50/EMA9 overlays,
 * RSI(14) subchart with 30/70 bands. Recharts-based, JARVIS styling.
 */
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TF = "1h" | "4h" | "1d";

const TF_LABELS: Record<TF, string> = { "1h": "1H", "4h": "4H", "1d": "1D" };

function fmtTime(sec: number, tf: TF) {
  const d = new Date(sec * 1000);
  if (tf === "1d")
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function GoldChart() {
  const [tf, setTf] = useState<TF>("1h");
  const { data, isLoading } = trpc.gold.chart.useQuery(
    { timeframe: tf },
    { refetchInterval: 60_000 }
  );

  const rows = useMemo(() => {
    if (!data) return [];
    const { candles, indicators } = data;
    // keep the chart readable: last 120 points
    const start = Math.max(0, candles.length - 120);
    return candles.slice(start).map((c, idx) => {
      const i = start + idx;
      return {
        time: c.time,
        label: fmtTime(c.time, tf),
        close: c.close,
        sma20: indicators.sma20[i],
        sma50: indicators.sma50[i],
        ema9: indicators.ema9[i],
        rsi: indicators.rsi14[i],
      };
    });
  }, [data, tf]);

  const domain = useMemo(() => {
    if (!rows.length) return ["auto", "auto"] as const;
    const vals = rows.flatMap(r =>
      [r.close, r.sma20, r.sma50, r.ema9].filter((v): v is number => v != null)
    );
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min) * 0.08 || 5;
    return [Math.floor(min - pad), Math.ceil(max + pad)] as const;
  }, [rows]);

  return (
    <section className="hud-panel hud-enter flex flex-col gap-2 p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="hud-title">PRICE RADAR</h2>
          <span className="font-cairo text-[11px] text-muted-foreground">الشارت التفاعلي</span>
        </div>
        <div className="flex gap-1" dir="ltr">
          {(Object.keys(TF_LABELS) as TF[]).map(k => (
            <button
              key={k}
              onClick={() => setTf(k)}
              className={`rounded border px-3 py-1 font-tech text-xs font-semibold tracking-widest transition-all duration-150 active:scale-95 ${
                tf === k
                  ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-300 shadow-[0_0_12px_rgba(245,197,66,0.25)]"
                  : "border-border text-muted-foreground hover:border-cyan-400/40 hover:text-cyan-300"
              }`}>
              {TF_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 font-tech text-[10px] tracking-wider" dir="ltr">
        <span className="text-yellow-300">— PRICE</span>
        <span className="text-cyan-300">— SMA20</span>
        <span className="text-purple-300">— SMA50</span>
        <span className="text-emerald-300">— EMA9</span>
      </div>

      {isLoading ? (
        <div className="h-72 animate-pulse rounded bg-accent/40" />
      ) : (
        <div dir="ltr">
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={rows} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="goldArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f5c542" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#f5c542" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fill: "#7d90ad", fontSize: 10, fontFamily: "Rajdhani" }}
                tickLine={false}
                axisLine={{ stroke: "rgba(56,189,248,0.15)" }}
                minTickGap={40}
              />
              <YAxis
                domain={domain as [number, number]}
                tick={{ fill: "#7d90ad", fontSize: 10, fontFamily: "Orbitron" }}
                tickLine={false}
                axisLine={false}
                width={55}
                tickFormatter={(v: number) => v.toFixed(0)}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(8,14,28,0.95)",
                  border: "1px solid rgba(56,189,248,0.3)",
                  borderRadius: 6,
                  fontFamily: "Rajdhani",
                  fontSize: 12,
                }}
                labelStyle={{ color: "#38bdf8" }}
                formatter={(value: number | string, name: string) => [
                  typeof value === "number" ? value.toFixed(2) : value,
                  name.toUpperCase(),
                ]}
              />
              <Area
                type="monotone"
                dataKey="close"
                name="price"
                stroke="#f5c542"
                strokeWidth={2}
                fill="url(#goldArea)"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="sma20"
                name="sma20"
                stroke="#38bdf8"
                strokeWidth={1.2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="sma50"
                name="sma50"
                stroke="#c084fc"
                strokeWidth={1.2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="ema9"
                name="ema9"
                stroke="#34d399"
                strokeWidth={1}
                strokeDasharray="4 3"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* RSI subchart */}
          <div className="mt-1 border-t border-border/50 pt-1">
            <div className="font-tech text-[10px] tracking-widest text-muted-foreground">RSI (14)</div>
            <ResponsiveContainer width="100%" height={80}>
              <ComposedChart data={rows} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <XAxis dataKey="label" hide />
                <YAxis
                  domain={[0, 100]}
                  ticks={[30, 70]}
                  tick={{ fill: "#7d90ad", fontSize: 9, fontFamily: "Orbitron" }}
                  tickLine={false}
                  axisLine={false}
                  width={55}
                />
                <ReferenceLine y={70} stroke="#f87171" strokeDasharray="4 4" strokeOpacity={0.5} />
                <ReferenceLine y={30} stroke="#34d399" strokeDasharray="4 4" strokeOpacity={0.5} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(8,14,28,0.95)",
                    border: "1px solid rgba(56,189,248,0.3)",
                    borderRadius: 6,
                    fontFamily: "Rajdhani",
                    fontSize: 12,
                  }}
                  formatter={(value: number | string) => [
                    typeof value === "number" ? value.toFixed(1) : value,
                    "RSI",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="rsi"
                  stroke="#38bdf8"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}
