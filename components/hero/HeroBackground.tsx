"use client";

/**
 * HeroBackground — mounts the 3D Monte Carlo plume behind the hero.
 *
 * Responsibilities kept OUT of the WebGL bundle so they cost nothing until
 * (and unless) the canvas actually renders:
 *   • prefers-reduced-motion  → render nothing (page keeps its CSS gradient)
 *   • in-view gating          → pause the render loop when scrolled away
 *   • quality tier            → fewer particles on small / low-power screens
 *   • milestone markers       → drive the singularity focus via a ref (no re-render)
 *   • P5 / P95 envelope labels
 */

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Quality } from "./MonteCarloPlume";

const MonteCarloPlume = dynamic(() => import("./MonteCarloPlume"), {
  ssr: false,
  loading: () => null,
});

/* World-x range must match MonteCarloPlume (X_MIN / X_MAX).
   Milestones sit over the *visible* diverged plume (right of the anchor) so a
   hover visibly compresses the particles right where the marker is. */
const X_MIN = -4.3;
const X_MAX = 4.7;
const MILE_X = [0.5, 1.4, 2.3, 3.2, 4.05];
const screenPct = (x: number) => ((x - X_MIN) / (X_MAX - X_MIN)) * 100;

/* Illustrative projection read-outs per milestone (compounding horizon).
   These are DECORATIVE outputs of the on-screen simulation — escalating growth
   multiples across the P5→P95 envelope — NOT real performance or edge data. */
const MILE_DATA = [
  { horizon: "T+1", p5: 1.1, p50: 1.4, p95: 1.9,  prof: 61 },
  { horizon: "T+2", p5: 1.3, p50: 2.0, p95: 3.1,  prof: 66 },
  { horizon: "T+3", p5: 1.6, p50: 2.9, p95: 5.2,  prof: 72 },
  { horizon: "T+4", p5: 2.0, p50: 4.1, p95: 8.8,  prof: 77 },
  { horizon: "T+5", p5: 2.4, p50: 5.8, p95: 14.6, prof: 81 },
];

export default function HeroBackground() {
  const hostRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef<number | null>(null);
  const progressRef = useRef(0);                  // scroll traversal 0..1
  const lockRef = useRef(false);                  // focus-lockdown state
  const [enabled, setEnabled] = useState(false); // passes reduced-motion + capability gate
  const [active, setActive] = useState(true);     // in-view
  const [hovered, setHovered] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [vw, setVw] = useState(0);                // viewport width (0 until measured)

  const quality: Quality = useMemo(() => {
    if (typeof window === "undefined") return "high";
    const smallOrCoarse =
      window.innerWidth < 900 ||
      window.matchMedia("(pointer: coarse)").matches ||
      (navigator.hardwareConcurrency ?? 8) <= 4;
    return smallOrCoarse ? "low" : "high";
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;               // leave the static gradient in place
    setEnabled(true);
    const sync = () => setVw(window.innerWidth);
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  /* Pause the loop when the hero scrolls out of view. */
  useEffect(() => {
    const el = hostRef.current;
    if (!el || !enabled) return;
    const io = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { threshold: 0.01 }
    );
    io.observe(el);
    const onVis = () => setActive(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  }, [enabled]);

  /* Scroll-driven camera traversal: 0 → 1 as the hero scrolls up and out. */
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = hostRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      progressRef.current = Math.min(Math.max(-r.top / ((r.height || 1) * 0.85), 0), 1);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled]);

  /* Focus-lockdown signal — the session app dispatches window "xtnl-lockdown"
     ({ detail: { active } }) when autonomous execution privileges are revoked. */
  useEffect(() => {
    const onLock = (e: Event) => {
      const on = (e as CustomEvent<{ active?: boolean }>).detail?.active ?? true;
      lockRef.current = on;
      setLocked(on);
    };
    window.addEventListener("xtnl-lockdown", onLock as EventListener);
    return () => window.removeEventListener("xtnl-lockdown", onLock as EventListener);
  }, []);

  function focus(i: number | null) {
    focusRef.current = i === null ? null : MILE_X[i];
    setHovered(i);
  }
  // tap-to-inspect for touch: toggle the tapped node
  function tap(i: number) {
    focus(hovered === i ? null : i);
  }

  if (!enabled) return null;

  // Interactive inspector + nodes on tablet/desktop; on phones the plume stays a
  // clean decorative background (no overlay to overflow or fight the touch UI).
  const showInspector = vw >= 700;

  return (
    <div ref={hostRef} aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {/* Canvas layer */}
      <div style={{ position: "absolute", inset: 0 }}>
        <MonteCarloPlume
          quality={quality}
          active={active}
          focusRef={focusRef}
          progressRef={progressRef}
          lockRef={lockRef}
        />
      </div>

      {/* Depth vignette — sinks the plume into the page and protects text contrast */}
      <div
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background:
            "radial-gradient(120% 90% at 50% 42%, transparent 0%, transparent 46%, rgba(4,8,15,0.55) 78%, var(--base) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "linear-gradient(180deg, rgba(4,8,15,0.35) 0%, transparent 22%, transparent 68%, var(--base) 100%)",
        }}
      />

      {/* Inspector — header by default, projected outcome distribution on hover */}
      {showInspector && (() => {
        const d = hovered === null ? null : MILE_DATA[hovered];
        return (
          <div style={{
            position: "absolute", top: "13%", right: "clamp(16px, 5vw, 80px)",
            width: 202, pointerEvents: "none",
            /* near-opaque backing so text stays legible where the plume shines through */
            background: "rgba(6,11,18,0.9)",
            border: `1px solid ${d ? "rgba(0,204,122,0.45)" : "rgba(150,180,220,0.22)"}`,
            borderRadius: 11,
            backdropFilter: "blur(16px) saturate(140%)", WebkitBackdropFilter: "blur(16px) saturate(140%)",
            padding: "10px 12px",
            boxShadow: d
              ? "0 8px 26px rgba(0,0,0,0.55), 0 0 24px rgba(0,204,122,0.12)"
              : "0 8px 22px rgba(0,0,0,0.5)",
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", boxShadow: "0 0 8px var(--green)", flexShrink: 0 }} />
              <span className="mono" style={{ fontSize: 9, letterSpacing: "0.15em", color: "var(--green)", fontWeight: 600 }}>
                MONTE CARLO PROJECTION
              </span>
            </div>
            <div style={{ fontSize: 10, color: "var(--ink-3, #64788c)", marginTop: 4 }}>
              1,000 simulated capital paths
            </div>

            <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "9px 0" }} />

            {!d ? (
              <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-3, #64788c)", letterSpacing: "0.03em", lineHeight: 1.55 }}>
                hover a node to inspect<br />the outcome distribution →
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                  <span className="mono" style={{ fontSize: 9.5, letterSpacing: "0.12em", color: "var(--ink-1, #9ab0c8)", fontWeight: 700 }}>
                    MILESTONE {hovered! + 1}
                  </span>
                  <span className="mono" style={{ fontSize: 9, color: "var(--ink-3, #64788c)" }}>
                    {d.horizon}
                  </span>
                </div>
                {([
                  ["P95", d.p95, "#7df0b0", "optimistic"],
                  ["P50", d.p50, "var(--ink-0, #eef2f8)", "median"],
                  ["P5",  d.p5,  "#4d9cf5", "baseline"],
                ] as [string, number, string, string][]).map(([lbl, val, col, sub]) => (
                  <div key={lbl} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "2px 0" }}>
                    <span className="mono" style={{ fontSize: 9.5, color: col, fontWeight: 700, width: 30 }}>{lbl}</span>
                    <span style={{ fontSize: 8.5, color: "var(--ink-3, #64788c)", flex: 1, marginLeft: 6 }}>{sub}</span>
                    <span className="mono" style={{ fontSize: 12.5, color: col, fontWeight: 700 }}>×{val.toFixed(1)}</span>
                  </div>
                ))}
                <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "8px 0 7px" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 9.5, color: "var(--ink-2, #9ab0c8)" }}>paths in profit</span>
                  <span className="mono" style={{ fontSize: 11.5, color: "var(--green)", fontWeight: 700 }}>{d.prof}%</span>
                </div>
                <div className="mono" style={{ fontSize: 7.5, color: "var(--ink-4, #4a5a6a)", marginTop: 8, letterSpacing: "0.05em" }}>
                  illustrative · not a forecast
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Milestone nodes — positioned over the visible plume; hover (or tap on
          touch) compresses the particles into a bright singularity at the node. */}
      {showInspector && MILE_X.map((x, i) => {
        const on = hovered === i;
        return (
          <button
            key={i}
            type="button"
            onMouseEnter={() => focus(i)}
            onMouseLeave={() => focus(null)}
            onTouchStart={(e) => { e.preventDefault(); tap(i); }}
            onFocus={() => focus(i)}
            onBlur={() => focus(null)}
            aria-label={`Milestone ${i + 1}`}
            style={{
              position: "absolute", left: `${screenPct(x)}%`, top: "47%",
              transform: "translate(-50%, -50%)",
              zIndex: 4,                       // lift above the hero content (zIndex 2) so all nodes are hoverable
              pointerEvents: "auto",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
              background: "none", border: "none", cursor: "pointer", padding: "12px 16px",
            }}
          >
            <span
              style={{
                width: on ? 13 : 8, height: on ? 13 : 8, borderRadius: "50%",
                background: on ? "var(--green-hi, #00f090)" : "rgba(154,176,200,0.5)",
                boxShadow: on
                  ? "0 0 20px 4px rgba(0,240,144,0.8)"
                  : "0 0 8px 1px rgba(154,176,200,0.25)",
                transition: "all 0.22s cubic-bezier(0.16,1,0.3,1)",
              }}
            />
            <span
              className="mono"
              style={{
                fontSize: 9, letterSpacing: "0.12em",
                color: on ? "var(--green)" : "var(--ink-3, #64788c)",
                opacity: on ? 1 : 0.6, transition: "all 0.2s",
              }}
            >
              M{i + 1}
            </span>
          </button>
        );
      })}

      {/* Focus-lockdown indicator — rigid red state + chromatic-aberration frame */}
      {locked && (
        <div style={{ position: "absolute", inset: 0, zIndex: 6, pointerEvents: "none" }}>
          <div style={{
            position: "absolute", inset: 0, mixBlendMode: "screen",
            background: "radial-gradient(130% 100% at 50% 45%, rgba(255,38,55,0.04) 0%, rgba(255,38,55,0.12) 58%, rgba(255,38,55,0.30) 100%)",
          }} />
          {/* chromatic aberration — offset red / cyan edges */}
          <div style={{ position: "absolute", inset: 0, boxShadow: "inset 3px 0 0 rgba(255,42,62,0.6), inset -3px 0 0 rgba(56,224,255,0.5), inset 0 0 70px rgba(255,38,55,0.35)" }} />
          <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 3px 0 rgba(255,42,62,0.45), inset 0 -3px 0 rgba(56,224,255,0.42)" }} />
          <div className="xtnl-lock-scan" style={{ position: "absolute", left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, rgba(255,64,84,0.85), transparent)" }} />
          <div style={{
            position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)",
            display: "flex", alignItems: "center", gap: 8,
            padding: "5px 14px", borderRadius: 10,
            background: "rgba(28,4,8,0.72)", border: "1px solid rgba(255,42,62,0.55)",
            boxShadow: "0 0 24px rgba(255,38,55,0.4)",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff2637", boxShadow: "0 0 10px #ff2637" }} />
            <span className="mono" style={{ fontSize: 10, letterSpacing: "0.16em", color: "#ff6675", fontWeight: 700 }}>
              FOCUS LOCKDOWN · AUTONOMOUS EXECUTION REVOKED
            </span>
          </div>
          <style>{`
            @keyframes xtnlScan { 0% { top: 6%; } 100% { top: 94%; } }
            .xtnl-lock-scan { animation: xtnlScan 1.9s linear infinite; box-shadow: 0 0 18px rgba(255,64,84,0.7); }
          `}</style>
        </div>
      )}
    </div>
  );
}
