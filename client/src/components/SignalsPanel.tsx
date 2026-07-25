/**
 * Technical signals with Arabic explanations + overall bias badge + key levels.
 */
import { trpc } from "@/lib/trpc";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

const biasStyle: Record<string, string> = {
  صاعد: "border-emerald-400/50 bg-emerald-400/10 text-emerald-300",
  هابط: "border-red-400/50 bg-red-400/10 text-red-300",
  محايد: "border-cyan-400/40 bg-cyan-400/10 text-cyan-300",
};

function SignalIcon({ type }: { type: "buy" | "sell" | "neutral" }) {
  if (type === "buy")
    return (
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-emerald-400/40 bg-emerald-400/10 text-emerald-300">
        <ArrowUpRight className="h-3.5 w-3.5" />
      </span>
    );
  if (type === "sell")
    return (
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-red-400/40 bg-red-400/10 text-red-300">
        <ArrowDownRight className="h-3.5 w-3.5" />
      </span>
    );
  return (
    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
      <Minus className="h-3.5 w-3.5" />
    </span>
  );
}

export default function SignalsPanel() {
  const { data, isLoading } = trpc.gold.chart.useQuery(
    { timeframe: "1d" },
    { refetchInterval: 120_000 }
  );
  const tech = data?.technical;

  return (
    <section className="hud-panel hud-enter flex flex-col gap-3 p-4 md:p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="hud-title">TACTICAL SIGNALS</h2>
          <span className="font-cairo text-[11px] text-muted-foreground">الإشارات الفنية — يومي</span>
        </div>
        {tech && (
          <span
            className={`rounded border px-2.5 py-0.5 font-cairo text-xs font-bold ${biasStyle[tech.bias] ?? biasStyle["محايد"]}`}>
            الاتجاه: {tech.bias}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-12 animate-pulse rounded bg-accent/40" />
          ))}
        </div>
      ) : (
        <>
          {/* Indicator snapshot */}
          <div className="grid grid-cols-4 gap-2 rounded border border-border/50 bg-accent/20 p-2" dir="ltr">
            {[
              { k: "RSI 14", v: tech?.rsi14?.toFixed(1) },
              { k: "EMA 9", v: tech?.ema9?.toFixed(1) },
              { k: "SMA 20", v: tech?.sma20?.toFixed(1) },
              { k: "SMA 50", v: tech?.sma50?.toFixed(1) },
            ].map(x => (
              <div key={x.k} className="text-center">
                <div className="font-tech text-[10px] tracking-wider text-muted-foreground">{x.k}</div>
                <div className="font-orbitron text-xs text-cyan-200 tabular">{x.v ?? "—"}</div>
              </div>
            ))}
          </div>

          {/* Signals list */}
          <ul className="jarvis-scroll flex max-h-56 flex-col gap-2 overflow-y-auto pe-1">
            {tech?.signals.map(s => (
              <li key={s.id} className="flex items-start gap-2.5 rounded border border-border/40 bg-accent/10 p-2.5">
                <SignalIcon type={s.type} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-cairo text-sm font-bold text-foreground">{s.title}</span>
                    <span className="rounded bg-accent/60 px-1.5 py-px font-cairo text-[10px] text-muted-foreground">
                      {s.strength}
                    </span>
                  </div>
                  <p className="font-cairo text-xs leading-relaxed text-muted-foreground">{s.reason}</p>
                </div>
              </li>
            ))}
            {tech && tech.signals.length === 0 && (
              <li className="font-cairo text-sm text-muted-foreground">لا توجد إشارات حالياً</li>
            )}
          </ul>

          {/* Key levels */}
          {tech && tech.levels.length > 0 && (
            <div className="border-t border-border/50 pt-2">
              <div className="mb-1.5 font-cairo text-[11px] text-muted-foreground">مستويات مهمة</div>
              <div className="flex flex-wrap gap-1.5" dir="ltr">
                {tech.levels.slice(0, 6).map((lv, i) => (
                  <span
                    key={i}
                    className={`rounded border px-2 py-0.5 font-orbitron text-[11px] tabular ${
                      lv.type === "support"
                        ? "border-emerald-400/40 text-emerald-300"
                        : "border-red-400/40 text-red-300"
                    }`}>
                    {lv.type === "support" ? "S" : "R"} {lv.price.toFixed(0)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

