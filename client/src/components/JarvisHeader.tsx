/**
 * Mission Control header: JARVIS wordmark, live clock, system status indicators.
 */
import { useEffect, useState } from "react";

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function JarvisHeader({ online }: { online: boolean }) {
  const now = useNow();
  const time = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const date = now.toLocaleDateString("ar-EG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="hud-panel hud-enter flex items-center justify-between gap-4 px-4 py-3 md:px-6">
      {/* Wordmark */}
      <div className="flex items-center gap-3">
        <div className="relative flex h-10 w-10 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-cyan-400/40" />
          <div
            className="absolute inset-1 rounded-full border border-dashed border-yellow-400/50 arc-spin-med"
            style={{ animationDuration: "10s" }}
          />
          <span className="glow-cyan font-orbitron text-sm font-bold">J</span>
        </div>
        <div className="leading-tight">
          <div className="font-orbitron text-lg font-bold tracking-[0.25em] text-foreground md:text-xl">
            J.A.R.V.I.S
          </div>
          <div className="font-cairo text-[11px] text-muted-foreground">
            نظام مراقبة وتحليل الذهب — GOLD COMMAND
          </div>
        </div>
      </div>

      {/* Status indicators */}
      <div className="hidden items-center gap-5 md:flex">
        <div className="flex items-center gap-2">
          <span
            className="status-dot"
            style={{ backgroundColor: online ? "#34d399" : "#f87171", color: online ? "#34d399" : "#f87171" }}
          />
          <span className="font-tech text-xs tracking-widest text-muted-foreground">
            SYSTEM {online ? "ONLINE" : "OFFLINE"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="status-dot" style={{ backgroundColor: "#38bdf8", color: "#38bdf8" }} />
          <span className="font-tech text-xs tracking-widest text-muted-foreground">
            DATA FEED ACTIVE
          </span>
        </div>
      </div>

      {/* Clock */}
      <div className="text-left" dir="ltr">
        <div className="glow-cyan font-orbitron text-lg font-semibold tabular md:text-xl">{time}</div>
        <div className="font-cairo text-[11px] text-muted-foreground" dir="rtl">
          {date}
        </div>
      </div>
    </header>
  );
}
