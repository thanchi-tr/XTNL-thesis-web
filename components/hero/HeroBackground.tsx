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

/* World-x range must match MonteCarloPlume (X_MIN / X_MAX). */
const X_MIN = -4.3;
const X_MAX = 4.7;
const MILESTONES = [0, 1, 2, 3, 4];
const markerFraction = (i: number) => (i + 0.72) / (MILESTONES.length + 0.4);
const markerWorldX = (i: number) => X_MIN + (X_MAX - X_MIN) * markerFraction(i);

export default function HeroBackground() {
  const hostRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef<number | null>(null);
  const progressRef = useRef(0);                  // scroll traversal 0..1
  const lockRef = useRef(false);                  // focus-lockdown state
  const [enabled, setEnabled] = useState(false); // passes reduced-motion + capability gate
  const [active, setActive] = useState(true);     // in-view
  const [hovered, setHovered] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [wide, setWide] = useState(false);        // room for the annotation caption

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
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
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
    focusRef.current = i === null ? null : markerWorldX(i);
    setHovered(i);
  }

  if (!enabled) return null;

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

      {/* "What am I looking at?" annotation */}
      {wide && (
        <div style={{
          position: "absolute", top: "13%", right: "clamp(20px, 6vw, 96px)",
          textAlign: "right", pointerEvents: "none", maxWidth: 300,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 7 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", boxShadow: "0 0 8px var(--green)" }} />
            <span className="mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--green)", fontWeight: 600 }}>
              MONTE CARLO PROJECTION
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-2, #9ab0c8)", marginTop: 5, lineHeight: 1.5 }}>
            1,000 simulated capital paths diverging from a single anchor
          </div>
          <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-3, #64788c)", marginTop: 4, letterSpacing: "0.04em" }}>
            hover a milestone to inspect the compounding front
          </div>
        </div>
      )}

      {/* P95 / P5 envelope labels */}
      <span style={envLabel("top")}>
        <i style={envDot("#7df0b0")} /> P95 · optimistic
      </span>
      <span style={envLabel("bottom")}>
        <i style={envDot("#3f78d8")} /> P5 · baseline
      </span>

      {/* Milestone markers — hover to compress the plume into a singularity */}
      <div
        style={{
          position: "absolute", left: 0, right: 0, bottom: "20%",
          display: "flex", justifyContent: "center", gap: "clamp(18px, 5vw, 64px)",
          pointerEvents: "none",
        }}
      >
        {MILESTONES.map((i) => {
          const on = hovered === i;
          return (
            <button
              key={i}
              type="button"
              onMouseEnter={() => focus(i)}
              onMouseLeave={() => focus(null)}
              onFocus={() => focus(i)}
              onBlur={() => focus(null)}
              aria-label={`Milestone ${i + 1}`}
              style={{
                pointerEvents: "auto",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                background: "none", border: "none", cursor: "pointer", padding: "6px 4px",
              }}
            >
              <span
                style={{
                  width: on ? 11 : 7, height: on ? 11 : 7, borderRadius: "50%",
                  background: on ? "var(--green-hi, #00f090)" : "rgba(154,176,200,0.4)",
                  boxShadow: on ? "0 0 16px 3px rgba(0,240,144,0.7)" : "none",
                  transition: "all 0.22s cubic-bezier(0.16,1,0.3,1)",
                }}
              />
              <span
                className="mono"
                style={{
                  fontSize: 9, letterSpacing: "0.12em",
                  color: on ? "var(--green)" : "var(--ink-3, #64788c)",
                  opacity: on ? 1 : 0.55, transition: "all 0.2s",
                }}
              >
                M{i + 1}
              </span>
            </button>
          );
        })}
      </div>

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

/* ── inline style helpers ─────────────────────────────────────── */
function envLabel(edge: "top" | "bottom"): React.CSSProperties {
  return {
    position: "absolute",
    right: "clamp(16px, 6vw, 96px)",
    [edge]: edge === "top" ? "26%" : "30%",
    display: "flex", alignItems: "center", gap: 7,
    fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em",
    color: "var(--ink-3, #64788c)", pointerEvents: "none",
    textTransform: "uppercase",
  };
}
function envDot(color: string): React.CSSProperties {
  return {
    width: 6, height: 6, borderRadius: "50%", background: color,
    boxShadow: `0 0 8px ${color}`, display: "inline-block",
  };
}
