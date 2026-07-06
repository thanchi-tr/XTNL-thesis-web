"use client";

import { useState, useEffect } from "react";

/* Melbourne AEST session hours: 18:00 – 01:00 */
function getAEST() {
  return new Date().toLocaleTimeString("en-AU", {
    timeZone: "Australia/Melbourne",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function sessionActive(): boolean {
  const now  = new Date();
  const aest = new Date(now.toLocaleString("en-US", { timeZone: "Australia/Melbourne" }));
  const h    = aest.getHours();
  return h >= 18 || h < 1;
}

const STATS = [
  { label: "SQN",         value: "4.253",     accent: "#00cc7a" },
  { label: "Expectancy",  value: "0.982 R",   accent: "#00cc7a" },
  { label: "OOS",         value: "+0.904 R",  accent: "#9ab0c8" },
  { label: "Profit Factor", value: "3.109×",  accent: "#9ab0c8" },
  { label: "Recommend R", value: "0.70%",     accent: "#4d9cf5" },
  { label: "Health",      value: "[ELITE]",   accent: "#00cc7a" },
  { label: "N (Core)",    value: "106",       accent: "#9ab0c8" },
];

export default function StatusBar() {
  const [time,    setTime]    = useState("--:--:--");
  const [active,  setActive]  = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const tick = () => {
      setTime(getAEST());
      setActive(sessionActive());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!mounted) return null;

  return (
    <div
      className="status-bar"
      style={{ position: "fixed", top: "var(--nav-h)", left: 0, right: 0, zIndex: 90 }}
    >
      <div
        className="site-container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 0,
          height: "100%",
        }}
      >
        {/* Left: session indicator + clock */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Pulsing dot */}
            <span
              style={{
                width: 5, height: 5, borderRadius: "50%",
                background: active ? "var(--green)" : "#2a3d52",
                display: "block",
                flexShrink: 0,
              }}
              className={active ? "pulse-dot" : ""}
            />
            <span
              style={{
                fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: active ? "var(--green)" : "var(--ink-3)",
                fontFamily: "var(--font-mono), monospace",
                transition: "color 0.5s",
              }}
            >
              {active ? "Session Active" : "Session Closed"}
            </span>
          </div>

          <span style={{ width: 1, height: 12, background: "var(--line)", display: "block" }} />

          <span
            className="mono"
            style={{ fontSize: 10, color: "var(--ink-2)", letterSpacing: "0.04em" }}
          >
            {time} AEST
          </span>
        </div>

        {/* Scrolling stats ticker */}
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            maskImage: "linear-gradient(to right, transparent 0, black 60px, black calc(100% - 60px), transparent 100%)",
            WebkitMaskImage: "linear-gradient(to right, transparent 0, black 60px, black calc(100% - 60px), transparent 100%)",
          }}
        >
          <div
            className="ticker-track"
            style={{
              display: "flex",
              gap: 32,
              padding: "0 32px",
              animation: "ticker 52s linear infinite",
              width: "max-content",
              willChange: "transform",
              backfaceVisibility: "hidden" as const,
            }}
          >
            {/* Duplicate for seamless loop */}
            {[...STATS, ...STATS].map(({ label, value, accent }, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                <span style={{ fontSize: 9, color: "var(--ink-3)", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", fontFamily: "var(--font-inter), sans-serif" }}>
                  {label}
                </span>
                <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: accent }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: system version — hidden on mobile */}
        <div className="nav-desktop" style={{ flexShrink: 0, alignItems: "center", gap: 10 }}>
          <span style={{ width: 1, height: 12, background: "var(--line)" }} />
          <span
            className="mono"
            style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.06em" }}
          >
            v5.2.5 · EUR/USD
          </span>
        </div>
      </div>

      <style>{`
        @keyframes ticker {
          0%         { transform: translate3d(0, 0, 0); }
          99.9999%   { transform: translate3d(-50%, 0, 0); }
          100%       { transform: translate3d(-50%, 0, 0); }
        }
        /* Pause on hover so user can read a stat */
        .ticker-track:hover { animation-play-state: paused; }
      `}</style>
    </div>
  );
}
