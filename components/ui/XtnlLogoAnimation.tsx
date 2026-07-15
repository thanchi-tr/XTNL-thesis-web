"use client";
import { useEffect } from "react";
import XtnlLogo from "./XtnlLogo";

export type XtnlAnimMode = "intro" | "success";

interface Props {
  mode: XtnlAnimMode;
  onDone?: () => void;
}

/*
 * Refined intro — a single, composed reveal (no piece-by-piece construction):
 *   0 – 620 ms   logo eases up from 0.9→1 with a glow bloom + expanding ring
 *   360 – 780 ms wordmark settles in (letter-spacing relaxes)
 *   1050 ms      overlay begins its fade
 *   ~1480 ms     onDone
 */
const CSS = `
.xi-wrap { animation: xi-fade-out 400ms ease 1060ms both; }
@keyframes xi-fade-out { from { opacity: 1; } to { opacity: 0; } }

.xi-logo {
  opacity: 0;
  animation: xi-logo-in 640ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes xi-logo-in {
  0%   { opacity: 0; transform: scale(0.9);  filter: drop-shadow(0 0 4px rgba(0,204,122,0)); }
  55%  { opacity: 1; }
  100% { opacity: 1; transform: scale(1);    filter: drop-shadow(0 0 24px rgba(0,204,122,0.38)); }
}

.xi-ring {
  transform-box: fill-box; transform-origin: center;
  animation: xi-ring 950ms cubic-bezier(0.22, 1, 0.36, 1) 140ms both;
}
@keyframes xi-ring {
  from { opacity: 0.55; transform: scale(0.35); }
  to   { opacity: 0;    transform: scale(1.9);  }
}

.xi-word {
  opacity: 0;
  animation: xi-word-in 460ms cubic-bezier(0.22, 1, 0.36, 1) 360ms both;
}
@keyframes xi-word-in {
  from { opacity: 0; transform: translateY(7px); letter-spacing: 0.44em; }
  to   { opacity: 1; transform: translateY(0);   letter-spacing: 0.22em; }
}

@media (prefers-reduced-motion: reduce) {
  .xi-logo, .xi-ring, .xi-word { animation-duration: 1ms !important; }
}
`;

export function XtnlLogoAnimation({ mode: _mode, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), 1480);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="xi-wrap"
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "var(--canvas, #020508)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 26,
      }}
    >
      <style>{CSS}</style>

      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg
          className="xi-ring"
          width="220" height="220" viewBox="0 0 220 220"
          style={{ position: "absolute" }}
          aria-hidden
        >
          <circle cx="110" cy="110" r="66" fill="none" stroke="rgba(0,204,122,0.4)" strokeWidth="1" />
        </svg>
        <div className="xi-logo">
          <XtnlLogo width={150} height={150} />
        </div>
      </div>

      <p
        className="xi-word"
        style={{
          margin: 0,
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 34, fontWeight: 800,
          letterSpacing: "0.22em", paddingRight: "0.22em",
          background: "linear-gradient(180deg, #ffffff 10%, #8ff2b8 155%)",
          WebkitBackgroundClip: "text", backgroundClip: "text",
          WebkitTextFillColor: "transparent", color: "transparent",
        }}
      >
        XTNL
      </p>
    </div>
  );
}
