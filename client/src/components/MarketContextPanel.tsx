/**
 * Market context strip: DXY, US10Y, oil, silver, S&P 500, Bitcoin.
 */
import { trpc } from "@/lib/trpc";

const LABELS: Record<string, { en: string; ar: string }> = {
  dxy: { en: "DXY", ar: "مؤشر الدولار" },
  us10y: { en: "US10Y", ar: "عائد السندات" },
  oil: { en: "WTI", ar: "النفط" },
  silver: { en: "XAG", ar: "الفضة" },
  sp500: { en: "S&P 500", ar: "إس آند بي" },
  bitcoin: { en: "BTC", ar: "بيتكوين" },
};

export default function MarketContextPanel() {
  const { data, isLoading } = trpc.gold.marketContext.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  return (
    <section className="hud-panel hud-enter p-3 md:p-4">
      <div className="mb-2 flex items-center gap-3">
        <h2 className="hud-title">GLOBAL MARKETS</h2>
        <span className="font-cairo text-[11px] text-muted-foreground">عوامل مؤثرة على الذهب</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {Object.keys(LABELS).map(key => {
          const q = data?.[key];
          const up = (q?.changePercent ?? 0) >= 0;
          return (
            <div key={key} className="rounded border border-border/40 bg-accent/10 p-2 text-center">
              <div className="font-tech text-[10px] tracking-widest text-cyan-300/80">{LABELS[key].en}</div>
              <div className="font-cairo text-[10px] text-muted-foreground">{LABELS[key].ar}</div>
              {isLoading ? (
                <div className="mx-auto mt-1 h-4 w-14 animate-pulse rounded bg-accent/50" />
              ) : q ? (
                <>
                  <div className="font-orbitron text-xs text-foreground tabular" dir="ltr">
                    {q.price >= 1000
                      ? q.price.toLocaleString("en-US", { maximumFractionDigits: 0 })
                      : q.price.toFixed(2)}
                  </div>
                  <div
                    className={`font-tech text-[11px] font-semibold tabular ${up ? "text-emerald-400" : "text-red-400"}`}
                    dir="ltr">
                    {up ? "+" : ""}
                    {q.changePercent.toFixed(2)}%
                  </div>
                </>
              ) : (
                <div className="font-tech text-xs text-muted-foreground">—</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

