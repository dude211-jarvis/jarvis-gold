/**
 * Animated ARC Reactor core — the Mission Control centerpiece.
 * Pure SVG + CSS animations (GPU-friendly transform/opacity only).
 */
import { useMemo } from "react";

type Props = {
  size?: number;
  speaking?: boolean;
};

export default function ArcReactor({ size = 300, speaking = false }: Props) {
  // Random particles inside the core (stable across renders)
  const particles = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        id: i,
        cx: 150 + (Math.random() - 0.5) * 90,
        cy: 150 + (Math.random() - 0.5) * 90,
        r: Math.random() * 1.8 + 0.6,
        dx: `${(Math.random() - 0.5) * 14}px`,
        dy: `${(Math.random() - 0.5) * 14}px`,
        dur: `${3 + Math.random() * 5}s`,
      })),
    []
  );

  const ticks = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => {
        const angle = (i / 48) * Math.PI * 2;
        const r1 = 128;
        const r2 = i % 4 === 0 ? 118 : 123;
        return {
          id: i,
          x1: 150 + Math.cos(angle) * r1,
          y1: 150 + Math.sin(angle) * r1,
          x2: 150 + Math.cos(angle) * r2,
          y2: 150 + Math.sin(angle) * r2,
        };
      }),
    []
  );

  return (
    <div
      className="relative select-none"
      style={{ width: size, height: size }}
      aria-hidden="true">
      <svg viewBox="0 0 300 300" width={size} height={size}>
        <defs>
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#bfe9ff" stopOpacity="0.95" />
            <stop offset="30%" stopColor="#38bdf8" stopOpacity="0.55" />
            <stop offset="70%" stopColor="#1e3a8a" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#050a14" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ringGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f5c542" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#f5c542" stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {/* Outer tick marks */}
        <g className="arc-ring arc-spin-slow">
          {ticks.map(t => (
            <line
              key={t.id}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.id % 8 === 0 ? "#f5c542" : "#38bdf8"}
              strokeOpacity={t.id % 8 === 0 ? 0.8 : 0.45}
              strokeWidth={t.id % 4 === 0 ? 2 : 1}
            />
          ))}
        </g>

        {/* Dashed outer ring */}
        <circle
          cx="150"
          cy="150"
          r="138"
          fill="none"
          stroke="#38bdf8"
          strokeOpacity="0.3"
          strokeWidth="1"
          strokeDasharray="4 10"
          className="arc-ring arc-spin-med"
        />

        {/* Gold segmented arc */}
        <g className="arc-ring arc-spin-med">
          <circle
            cx="150"
            cy="150"
            r="108"
            fill="none"
            stroke="url(#ringGold)"
            strokeWidth="2.5"
            strokeDasharray="70 40 30 60"
            strokeLinecap="round"
          />
        </g>

        {/* Cyan inner segmented arc */}
        <g className="arc-ring arc-spin-fast">
          <circle
            cx="150"
            cy="150"
            r="92"
            fill="none"
            stroke="#38bdf8"
            strokeOpacity="0.6"
            strokeWidth="1.5"
            strokeDasharray="30 22 50 20"
            strokeLinecap="round"
          />
        </g>

        {/* Hex-ish inner ring */}
        <circle
          cx="150"
          cy="150"
          r="76"
          fill="none"
          stroke="#38bdf8"
          strokeOpacity="0.25"
          strokeWidth="6"
          strokeDasharray="2 6"
          className="arc-ring arc-spin-slow"
        />

        {/* Core glow */}
        <circle cx="150" cy="150" r="70" fill="url(#coreGlow)" className="arc-core-glow" />

        {/* Particles */}
        <g>
          {particles.map(p => (
            <circle
              key={p.id}
              cx={p.cx}
              cy={p.cy}
              r={p.r}
              fill="#9fdcff"
              className="arc-particle"
              style={
                {
                  "--dx": p.dx,
                  "--dy": p.dy,
                  "--dur": p.dur,
                } as React.CSSProperties
              }
            />
          ))}
        </g>

        {/* Speaking pulse ring */}
        {speaking && (
          <circle
            cx="150"
            cy="150"
            r="60"
            fill="none"
            stroke="#f5c542"
            strokeOpacity="0.7"
            strokeWidth="2"
            className="animate-ping"
            style={{ transformOrigin: "center" }}
          />
        )}
      </svg>
    </div>
  );
}
