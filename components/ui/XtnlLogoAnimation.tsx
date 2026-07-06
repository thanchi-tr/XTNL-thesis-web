"use client";
import { useEffect, useState } from "react";

export type XtnlAnimMode = "intro" | "success";

interface Props {
  mode: XtnlAnimMode;
  onDone?: () => void;
}

/*
 * Animation timeline (all timings in ms):
 *
 * Phase 1 — white dots appear one by one     0 – 480 ms
 * Phase 2 — green nodes grow, verts appear   540 – 1060 ms
 * Phase 3 — lines draw from left vertex      990 – 1740 ms
 * Phase 4 — logo scales up 22%              1780 – 2040 ms
 * Phase 5 — X T N L fade in letter-by-letter 1820 – 2410 ms
 * Fade-out                                   2500 – 2900 ms
 * onDone callback                            2950 ms
 */

const CSS = `
/* ── Phase 1: white dots ─────────────────────────────────────────────────── */
.xa-wd {
  fill: white;
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: xa-dot 160ms cubic-bezier(0.34,1.56,0.64,1) both;
}
.xa-wd-a { animation-delay:   0ms; }
.xa-wd-b { animation-delay:  80ms; }
.xa-wd-c { animation-delay: 160ms; }
.xa-wd-d { animation-delay: 240ms; }
.xa-wd-e { animation-delay: 320ms; }
@keyframes xa-dot {
  from { opacity: 0; transform: scale(0); }
  to   { opacity: 1; transform: scale(1); }
}

/* ── Phase 2: green nodes ────────────────────────────────────────────────── */
.xa-node {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: xa-node-grow 330ms cubic-bezier(0.34,1.56,0.64,1) both;
}
.xa-node-a { animation-delay: 540ms; }
.xa-node-b { animation-delay: 640ms; }
@keyframes xa-node-grow {
  from { opacity: 0; transform: scale(0);    }
  65%  {             transform: scale(1.10); }
  to   { opacity: 1; transform: scale(1);    }
}

/* ── Phase 2: dim vertices ───────────────────────────────────────────────── */
.xa-vert {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: xa-vert-in 220ms ease both;
}
.xa-vert-l { animation-delay: 720ms; }
.xa-vert-r { animation-delay: 780ms; }
.xa-vert-b { animation-delay: 840ms; }
@keyframes xa-vert-in {
  from { opacity: 0; transform: scale(0.4); }
  to   { opacity: 1; transform: scale(1);   }
}

/* ── Phase 3: lines (stroke-dashoffset draw) ─────────────────────────────── */
@keyframes xa-l-mid     { from { stroke-dashoffset: 46; } to { stroke-dashoffset: 0; } }
@keyframes xa-l-lower-l { from { stroke-dashoffset: 32; } to { stroke-dashoffset: 0; } }
@keyframes xa-l-cross-b { from { stroke-dashoffset: 52; } to { stroke-dashoffset: 0; } }
@keyframes xa-l-upper-l { from { stroke-dashoffset: 33; } to { stroke-dashoffset: 0; } }
@keyframes xa-l-upper-r { from { stroke-dashoffset: 33; } to { stroke-dashoffset: 0; } }
@keyframes xa-l-cross-a { from { stroke-dashoffset: 57; } to { stroke-dashoffset: 0; } }
@keyframes xa-l-lower-r { from { stroke-dashoffset: 32; } to { stroke-dashoffset: 0; } }

.xa-l-mid     { stroke-dasharray: 46; animation: xa-l-mid      130ms ease  990ms both; }
.xa-l-lower-l { stroke-dasharray: 32; animation: xa-l-lower-l  100ms ease 1110ms both; }
.xa-l-cross-b { stroke-dasharray: 52; animation: xa-l-cross-b  140ms ease 1210ms both; }
.xa-l-upper-l { stroke-dasharray: 33; animation: xa-l-upper-l  100ms ease 1330ms both; }
.xa-l-upper-r { stroke-dasharray: 33; animation: xa-l-upper-r  100ms ease 1430ms both; }
.xa-l-cross-a { stroke-dasharray: 57; animation: xa-l-cross-a  150ms ease 1530ms both; }
.xa-l-lower-r { stroke-dasharray: 32; animation: xa-l-lower-r   90ms ease 1650ms both; }

.xa-poly {
  opacity: 0;
  animation: xa-vert-in 200ms ease 1430ms both;
}

/* ── Phase 4: scale-up wrapper ───────────────────────────────────────────── */
.xa-logo-scale {
  animation: xa-scale-up 260ms cubic-bezier(0.34,1.56,0.64,1) 1780ms both;
}
@keyframes xa-scale-up {
  from { transform: scale(1);    }
  to   { transform: scale(1.22); }
}

/* ── Phase 5: letters ────────────────────────────────────────────────────── */
.xa-letter {
  opacity: 0;
  display: inline-block;
  animation: xa-letter-in 230ms ease both;
}
@keyframes xa-letter-in {
  from { opacity: 0; transform: translateY(9px); }
  to   { opacity: 1; transform: translateY(0);   }
}

/* ── Overlay exit ────────────────────────────────────────────────────────── */
.xa-exit {
  animation: xa-fade-out 400ms ease both;
  pointer-events: none;
}
@keyframes xa-fade-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}
`;

export function XtnlLogoAnimation({ mode: _mode, onDone }: Props) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setExiting(true), 2500);
    const t2 = setTimeout(() => onDone?.(), 2950);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={exiting ? "xa-exit" : undefined}
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "var(--canvas, #020508)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 32,
      }}
    >
      <style>{CSS}</style>

      {/* ── Phase 4 wrapper — scale-up 22% ──── */}
      <div className="xa-logo-scale">
        <svg viewBox="0 0 80 80" width="244" height="244" fill="none" aria-hidden>

          {/* ── Phase 1: white dots appear one by one ─────────────────────── */}
          <circle className="xa-wd xa-wd-a" cx="27" cy="8"  r="3.4" />
          <circle className="xa-wd xa-wd-b" cx="51" cy="13" r="3.0" />
          <circle className="xa-wd xa-wd-c" cx="17" cy="52" r="2.4" />
          <circle className="xa-wd xa-wd-d" cx="63" cy="52" r="2.4" />
          <circle className="xa-wd xa-wd-e" cx="40" cy="74" r="2.0" />

          {/* ── Phase 3: lines draw from left vertex (17,52) outward ─────── */}
          {/* 1. Midline (17,52)→(63,52) */}
          <line className="xa-l-mid"
            x1="17" y1="52" x2="63" y2="52"
            stroke="rgba(0,204,122,0.22)" strokeWidth="1" />
          {/* 2. Lower-left (17,52)→(40,74) */}
          <line className="xa-l-lower-l"
            x1="17" y1="52" x2="40" y2="74"
            stroke="rgba(0,204,122,0.09)" strokeWidth="1.5" strokeLinecap="round" />
          {/* 3. Cross-B reversed — draw from (17,52) up toward node B */}
          <line className="xa-l-cross-b"
            x1="17" y1="52" x2="51" y2="13"
            stroke="rgba(0,204,122,0.28)" strokeWidth="1.5" strokeLinecap="round" />
          {/* 4. Upper-left reversed — from (17,52) up to diamond apex */}
          <line className="xa-l-upper-l"
            x1="17" y1="52" x2="40" y2="29"
            stroke="rgba(0,204,122,0.15)" strokeWidth="1.3" strokeLinecap="round" />
          {/* 5. Upper-right — apex to right vertex */}
          <line className="xa-l-upper-r"
            x1="40" y1="29" x2="63" y2="52"
            stroke="rgba(0,204,122,0.15)" strokeWidth="1.3" strokeLinecap="round" />
          {/* Upper polygon fill (fades in with upper-right) */}
          <polygon className="xa-poly"
            points="40,29 63,52 17,52"
            fill="rgba(0,204,122,0.03)" />
          {/* 6. Cross-A — node A down to right vertex */}
          <line className="xa-l-cross-a"
            x1="27" y1="8" x2="63" y2="52"
            stroke="rgba(0,204,122,0.52)" strokeWidth="1.5" strokeLinecap="round" />
          {/* 7. Lower-right — right vertex to bottom */}
          <line className="xa-l-lower-r"
            x1="63" y1="52" x2="40" y2="74"
            stroke="rgba(0,204,122,0.09)" strokeWidth="1.5" strokeLinecap="round" />

          {/* ── Phase 2: colored elements appear over white dots ─────────── */}
          {/* Node A — green glow */}
          <g className="xa-node xa-node-a"
            style={{ transformBox: "fill-box" as const, transformOrigin: "center" }}>
            <circle cx="27" cy="8" r="8"   fill="rgba(0,204,122,0.10)" />
            <circle cx="27" cy="8" r="5"   fill="rgba(0,204,122,0.72)"
              style={{ filter: "drop-shadow(0 0 4px #00cc7a)" }} />
            <circle cx="27" cy="8" r="2.8" fill="#b0ffe0" />
          </g>
          {/* Node B — green glow */}
          <g className="xa-node xa-node-b"
            style={{ transformBox: "fill-box" as const, transformOrigin: "center" }}>
            <circle cx="51" cy="13" r="7"   fill="rgba(0,204,122,0.08)" />
            <circle cx="51" cy="13" r="4.5" fill="rgba(0,204,122,0.65)"
              style={{ filter: "drop-shadow(0 0 3px #00cc7a)" }} />
            <circle cx="51" cy="13" r="2.2" fill="#b0ffe0" />
          </g>
          {/* Left vertex — dim green */}
          <g className="xa-vert xa-vert-l"
            style={{ transformBox: "fill-box" as const, transformOrigin: "center" }}>
            <circle cx="17" cy="52" r="1.8" fill="rgba(0,204,122,0.22)" />
          </g>
          {/* Right vertex — blue accent */}
          <g className="xa-vert xa-vert-r"
            style={{ transformBox: "fill-box" as const, transformOrigin: "center" }}>
            <circle cx="63" cy="52" r="3.2" fill="none" stroke="rgba(0,180,255,0.45)" strokeWidth="1" />
            <circle cx="63" cy="52" r="1.8" fill="#00b4ff" opacity="0.7" />
          </g>
          {/* Bottom vertex — hollow ring */}
          <g className="xa-vert xa-vert-b"
            style={{ transformBox: "fill-box" as const, transformOrigin: "center" }}>
            <circle cx="40" cy="74" r="3" fill="none" stroke="rgba(0,204,122,0.22)" strokeWidth="1" />
          </g>
        </svg>
      </div>

      {/* ── Phase 5: XTNL letters one by one ──── */}
      <div style={{ display: "flex", gap: 0, alignItems: "baseline" }} aria-label="XTNL">
        {"XTNL".split("").map((ch, i) => (
          <span
            key={ch}
            className="xa-letter"
            style={{
              animationDelay: `${1820 + i * 120}ms`,
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 37,
              fontWeight: 800,
              letterSpacing: i < 3 ? "0.22em" : "0",
              color: "var(--ink-0, #eef2f8)",
            }}
          >
            {ch}
          </span>
        ))}
      </div>
    </div>
  );
}
