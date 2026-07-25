/**
 * JARVIS Gold — Mission Control layout (RTL).
 * Header on top, Arc Reactor centerpiece, HUD panels around it.
 */
import AIAnalysisPanel from "@/components/AIAnalysisPanel";
import ApiHealthBanner from "@/components/ApiHealthBanner";
import ArcReactor from "@/components/ArcReactor";
import GoldChart from "@/components/GoldChart";
import GoldPriceCard from "@/components/GoldPriceCard";
import JarvisChat from "@/components/JarvisChat";
import JarvisHeader from "@/components/JarvisHeader";
import MarketContextPanel from "@/components/MarketContextPanel";
import SignalsPanel from "@/components/SignalsPanel";
import { useJarvisVoice } from "@/hooks/useJarvisVoice";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef } from "react";

export default function Home() {
  const voice = useJarvisVoice();
  const { data: quote, isError } = trpc.gold.quote.useQuery(undefined, { refetchInterval: 30_000 });
  const greeted = useRef(false);
  const quoteRef = useRef(quote);
  quoteRef.current = quote;

  // Auto-greeting: browsers block audio before the first user gesture,
  // so JARVIS greets right after the first click/keypress anywhere.
  useEffect(() => {
    if (!voice.supported) return;
    const greet = () => {
      if (greeted.current) return;
      greeted.current = true;
      const q = quoteRef.current;
      let briefing =
        "Good day, Commander. JARVIS online. All systems operational. Gold market surveillance is active.";
      if (q) {
        const dir = q.change >= 0 ? "up" : "down";
        briefing += ` Gold is currently trading at ${Math.round(q.price)} dollars, ${dir} ${Math.abs(
          q.changePercent
        ).toFixed(2)} percent today, ranging between ${Math.round(q.dayLow)} and ${Math.round(
          q.dayHigh
        )} dollars.`;
      }
      voice.speak(briefing);
      window.removeEventListener("pointerdown", greet);
      window.removeEventListener("keydown", greet);
    };
    window.addEventListener("pointerdown", greet);
    window.addEventListener("keydown", greet);
    return () => {
      window.removeEventListener("pointerdown", greet);
      window.removeEventListener("keydown", greet);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.supported]);

  return (
    <div dir="rtl" className="jarvis-bg relative min-h-screen">
      <div className="jarvis-scanline" />

      <div className="relative z-10 flex w-full flex-col gap-3 p-3 md:gap-4 md:p-5 2xl:px-8">
        <JarvisHeader online={!isError} />

        <ApiHealthBanner voice={voice} />

        {/* Top zone: price | reactor | signals */}
        <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-[1fr_auto_1fr] 2xl:grid-cols-[1.2fr_auto_1.2fr]">
          <div className="order-2 lg:order-1">
            <GoldPriceCard />
          </div>

          {/* Arc Reactor centerpiece */}
          <div className="order-1 flex flex-col items-center justify-center lg:order-2">
            <ArcReactor size={300} speaking={voice.speaking} />
            <div className="-mt-4 text-center">
              <div className="font-tech text-[10px] tracking-[0.3em] text-cyan-300/70">
                GOLD CORE {voice.speaking ? "· SPEAKING" : "· MONITORING"}
              </div>
            </div>
          </div>

          <div className="order-3">
            <SignalsPanel />
          </div>
        </div>

        {/* Middle zone: chart | AI analysis — on ultrawide, chat joins the row */}
        <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-[3fr_2fr] 2xl:grid-cols-[5fr_3fr_4fr]">
          <GoldChart />
          <AIAnalysisPanel voice={voice} />
          <div className="lg:col-span-2 2xl:col-span-1">
            <JarvisChat voice={voice} />
          </div>
        </div>

        {/* Global markets strip */}
        <MarketContextPanel />

        <footer className="pb-2 text-center">
          <p className="font-tech text-[10px] tracking-[0.25em] text-muted-foreground/50" dir="ltr">
            J.A.R.V.I.S GOLD COMMAND · DATA: YAHOO FINANCE · NOT FINANCIAL ADVICE
          </p>
          <p className="font-cairo text-[10px] text-muted-foreground/50">
            المعلومات لأغراض تعليمية فقط وليست نصيحة استثمارية
          </p>
        </footer>
      </div>
    </div>
  );
}
