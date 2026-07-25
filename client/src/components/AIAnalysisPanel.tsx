/**
 * Daily AI analysis in Arabic + a speak button that reads an Arabic
 * briefing aloud (JARVIS voice).
 */
import { trpc } from "@/lib/trpc";
import { Minus, RefreshCw, ThumbsDown, ThumbsUp, Volume2, VolumeX } from "lucide-react";

type Voice = {
  speak: (text: string) => void;
  stop: () => void;
  speaking: boolean;
  supported: boolean;
};

function ImpactIcon({ impact }: { impact: string }) {
  if (impact === "إيجابي") return <ThumbsUp className="h-3.5 w-3.5 text-emerald-300" />;
  if (impact === "سلبي") return <ThumbsDown className="h-3.5 w-3.5 text-red-300" />;
  return <Minus className="h-3.5 w-3.5 text-cyan-300" />;
}

/** Build a spoken Arabic briefing from the analysis + live quote. */
function buildArabicBriefing(opts: {
  price?: number;
  changePercent?: number;
  bias?: string;
  rsi?: number | null;
}): string {
  const { price, changePercent, bias, rsi } = opts;
  const dir = changePercent == null ? "" : changePercent >= 0 ? "مرتفعاً" : "منخفضاً";
  const biasAr = bias === "صاعد" ? "صاعد" : bias === "هابط" ? "هابط" : "محايد";
  const parts: string[] = ["أهلاً يا سيدي، هذا موجز سوق الذهب."];
  if (price != null) {
    parts.push(
      `يتداول الذهب حالياً عند ${price.toFixed(0)} دولاراً للأونصة، ${dir} بنسبة ${Math.abs(changePercent ?? 0).toFixed(2)} بالمئة اليوم.`
    );
  }
  parts.push(`الاتجاه الفني العام ${biasAr}.`);
  if (rsi != null) {
    const zone = rsi >= 70 ? "منطقة التشبع الشرائي" : rsi <= 30 ? "منطقة التشبع البيعي" : "المنطقة المحايدة";
    parts.push(`مؤشر القوة النسبية عند ${rsi.toFixed(0)}، في ${zone}.`);
  }
  parts.push("التحليل الكامل معروض أمامك على الشاشة. في خدمتك دائماً يا سيدي.");
  return parts.join(" ");
}

export default function AIAnalysisPanel({ voice }: { voice: Voice }) {
  const { data, isLoading, isFetching, refetch } = trpc.ai.dailyAnalysis.useQuery(undefined, {
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const { data: q } = trpc.gold.quote.useQuery(undefined, { refetchInterval: 30_000 });
  const { data: chart } = trpc.gold.chart.useQuery({ timeframe: "1d" }, { refetchInterval: 120_000 });

  const onSpeak = () => {
    if (voice.speaking) {
      voice.stop();
      return;
    }
    voice.speak(
      buildArabicBriefing({
        price: q?.price,
        changePercent: q?.changePercent,
        bias: chart?.technical.bias,
        rsi: chart?.technical.rsi14,
      })
    );
  };

  return (
    <section className="hud-panel hud-panel-gold hud-enter flex flex-col gap-3 p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="hud-title">AI INTELLIGENCE</h2>
          <span className="font-cairo text-[11px] text-muted-foreground">التحليل اليومي</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="تحديث التحليل"
            className="flex h-7 w-7 items-center justify-center rounded border border-border text-muted-foreground transition-all duration-150 hover:border-cyan-400/50 hover:text-cyan-300 active:scale-95 disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </button>
          {voice.supported && (
            <button
              onClick={onSpeak}
              title={voice.speaking ? "إيقاف الصوت" : "استمع للملخص بصوت جارفس"}
              className={`flex h-7 items-center gap-1.5 rounded border px-2 font-tech text-[11px] tracking-wider transition-all duration-150 active:scale-95 ${
                voice.speaking
                  ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-300"
                  : "border-border text-muted-foreground hover:border-yellow-400/50 hover:text-yellow-300"
              }`}>
              {voice.speaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              {voice.speaking ? "STOP" : "BRIEF ME"}
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-16 animate-pulse rounded bg-accent/40" />
          <div className="h-24 animate-pulse rounded bg-accent/40" />
          <div className="font-cairo text-xs text-muted-foreground">
            جارفس يحلل السوق الآن...
          </div>
        </div>
      ) : data ? (
        <div className="jarvis-scroll flex max-h-80 flex-col gap-3 overflow-y-auto pe-1">
          <p className="font-cairo text-sm leading-relaxed text-foreground">{data.summary}</p>

          <div>
            <div className="mb-1.5 font-cairo text-[11px] font-bold text-yellow-300/90">العوامل المؤثرة</div>
            <ul className="flex flex-col gap-1.5">
              {data.factors.map((f, i) => (
                <li key={i} className="flex items-start gap-2 rounded border border-border/40 bg-accent/10 p-2">
                  <span className="mt-0.5 shrink-0">
                    <ImpactIcon impact={f.impact} />
                  </span>
                  <div>
                    <span className="font-cairo text-xs font-bold text-foreground">{f.title}</span>
                    <span className="mx-1.5 font-cairo text-[10px] text-muted-foreground">({f.impact})</span>
                    <p className="font-cairo text-xs leading-relaxed text-muted-foreground">{f.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded border border-cyan-400/20 bg-cyan-400/5 p-2.5">
            <div className="mb-1 font-cairo text-[11px] font-bold text-cyan-300">النظرة المستقبلية</div>
            <p className="font-cairo text-xs leading-relaxed text-foreground/90">{data.outlook}</p>
          </div>

          <div className="font-tech text-[10px] tracking-wider text-muted-foreground/70" dir="ltr">
            GENERATED: {new Date(data.generatedAt).toLocaleString("en-GB")}
          </div>
        </div>
      ) : (
        <p className="font-cairo text-sm text-muted-foreground">تعذر توليد التحليل حالياً. حاول التحديث.</p>
      )}
    </section>
  );
}
