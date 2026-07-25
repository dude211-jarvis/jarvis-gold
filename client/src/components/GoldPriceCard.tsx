/**
 * Live XAU/USD price with day stats.
 */
import { trpc } from "@/lib/trpc";
import { TrendingDown, TrendingUp } from "lucide-react";

function fmt(n: number | undefined | null, digits = 2) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default function GoldPriceCard() {
  const { data: q, isLoading, dataUpdatedAt } = trpc.gold.quote.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const up = (q?.change ?? 0) >= 0;

  return (
    <section className="hud-panel hud-panel-gold hud-enter flex flex-col gap-3 p-4 md:p-5">
      <div className="flex items-center justify-between">
        <h2 className="hud-title">XAU/USD — LIVE</h2>
        <span className="font-cairo text-[11px] text-muted-foreground">الذهب الفوري</span>
      </div>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded bg-accent/40" />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3" dir="ltr">
            <span className="glow-gold font-orbitron text-4xl font-bold tabular md:text-5xl">
              ${fmt(q?.price)}
            </span>
            <span
              className={`flex items-center gap-1 pb-1 font-tech text-base font-semibold tabular ${
                up ? "text-emerald-400" : "text-red-400"
              }`}>
              {up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {up ? "+" : ""}
              {fmt(q?.change)} ({up ? "+" : ""}
              {fmt(q?.changePercent)}%)
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-3">
            <div>
              <div className="font-cairo text-[11px] text-muted-foreground">أعلى اليوم</div>
              <div className="font-orbitron text-sm text-emerald-300 tabular" dir="ltr">
                {fmt(q?.dayHigh)}
              </div>
            </div>
            <div>
              <div className="font-cairo text-[11px] text-muted-foreground">أدنى اليوم</div>
              <div className="font-orbitron text-sm text-red-300 tabular" dir="ltr">
                {fmt(q?.dayLow)}
              </div>
            </div>
            <div>
              <div className="font-cairo text-[11px] text-muted-foreground">الإغلاق السابق</div>
              <div className="font-orbitron text-sm text-foreground tabular" dir="ltr">
                {fmt(q?.prevClose)}
              </div>
            </div>
          </div>

          <div className="font-tech text-[10px] tracking-wider text-muted-foreground/70" dir="ltr">
            LAST SYNC:{" "}
            {dataUpdatedAt
              ? new Date(dataUpdatedAt).toLocaleTimeString("en-GB")
              : "—"}{" "}
            · SOURCE: COMEX GC=F
          </div>
        </>
      )}
    </section>
  );
}

