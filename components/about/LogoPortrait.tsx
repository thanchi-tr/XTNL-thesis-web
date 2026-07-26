"use client";

/**
 * LogoPortrait — the XTNL mark as a real, physical 3D object (see
 * LogoMesh3D: actual tube/sphere geometry, not a flat SVG with a CSS
 * transform, which collapses to an invisible sliver past 90°). Drag it and
 * it spins with momentum; release mid-drag and it keeps turning, decays with
 * friction, and settles into a slow perpetual showcase rotation. A thin
 * radar ring + orbiting signature-node satellites (plain DOM, synced to the
 * same rotation refs the 3D mesh reads) frame it.
 *
 * Reduced-motion / off-screen users get the WebGL canvas unmounted entirely
 * — the mark still renders (LogoMesh3D's first frame), just doesn't spin.
 */

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const AccentCanvas = dynamic(() => import("@/components/hero/AccentCanvas"), { ssr: false, loading: () => null });
const LogoMesh3D = dynamic(() => import("@/components/about/LogoMesh3D"), { ssr: false, loading: () => null });

const DRAG_SENSITIVITY = 0.026; // radians per px — a full-width drag is roughly two full turns
const MAX_HOVER_TILT = 0.22;    // radians
const MAX_FLICK_VELOCITY = 0.42; // radians/frame, clamped on release

export default function LogoPortrait() {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const orbitRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(true);
  const [showHint, setShowHint] = useState(true);

  // Shared physics refs — LogoMesh3D's own useFrame mutates spinY/velocity
  // every frame; this component just READS them to keep the HTML ring/orbit
  // overlay in sync, and WRITES them on drag.
  const spinY = useRef(0);
  const velocity = useRef(0);
  const tilt = useRef(0);
  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartSpin = useRef(0);
  const lastDragX = useRef(0);

  useEffect(() => {
    setEnabled(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || !enabled) return;
    const io = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);

  /* Lightweight overlay-sync loop — the ring and orbit dots are plain DOM,
     driven by the same spin value the 3D mesh is animating toward. */
  useEffect(() => {
    if (!enabled || !active) return;
    let raf = 0;
    const tick = () => {
      const speed = Math.min(1, Math.abs(velocity.current) / MAX_FLICK_VELOCITY);
      const deg = (spinY.current * 180) / Math.PI;

      if (ringRef.current) {
        ringRef.current.style.transform = `rotate(${(deg * 0.6).toFixed(2)}deg)`;
        ringRef.current.style.opacity = (0.28 + speed * 0.5).toFixed(2);
        ringRef.current.style.filter = `blur(${speed * 1.2}px)`;
      }
      orbitRefs.current.forEach((el, i) => {
        if (!el) return;
        const base = (i + 1) * 0.55;
        const dir = i % 2 === 0 ? 1 : -1;
        el.style.transform = `rotate(${(deg * base * dir * 0.9).toFixed(2)}deg)`;
      });

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, active]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!enabled) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = true;
    dragStartX.current = e.clientX;
    lastDragX.current = e.clientX;
    dragStartSpin.current = spinY.current;
    velocity.current = 0;
    setShowHint(false);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!enabled) return;
    const r = stageRef.current?.getBoundingClientRect();
    if (r && !dragging.current) {
      const py = (e.clientY - r.top) / r.height - 0.5;
      tilt.current = py * -2 * MAX_HOVER_TILT;
    }
    if (!dragging.current) return;
    const dx = e.clientX - dragStartX.current;
    spinY.current = dragStartSpin.current + dx * DRAG_SENSITIVITY;
    // Per-event delta (not divided by wall-clock time) — pointermove firing
    // rate is irregular enough that a time-normalized velocity spikes/jitters;
    // this simple per-move delta, clamped on release, feels smoother in practice.
    velocity.current = (e.clientX - lastDragX.current) * DRAG_SENSITIVITY;
    lastDragX.current = e.clientX;
  }
  function onPointerUp() {
    dragging.current = false;
    velocity.current = Math.max(-MAX_FLICK_VELOCITY, Math.min(MAX_FLICK_VELOCITY, velocity.current));
  }
  function onMouseLeaveStage() {
    if (!dragging.current) tilt.current = 0;
  }

  return (
    <div
      ref={hostRef}
      style={{
        position: "relative",
        // Explicit equal width/height (not aspect-ratio) — guarantees a true
        // square for the WebGL camera framing regardless of layout timing.
        width: "min(580px, 90vw)",
        height: "min(580px, 90vw)",
        margin: "0 auto",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {/* WebGL depth layer — mean-reversion well backdrop */}
      {enabled && (
        <div aria-hidden style={{ position: "absolute", inset: "-40%", zIndex: 0 }}>
          <AccentCanvas variant="well" active={active} />
        </div>
      )}

      {/* Thin rotating radar ring */}
      <div
        ref={ringRef}
        aria-hidden
        style={{
          position: "absolute", inset: "10%", zIndex: 1, borderRadius: "50%",
          border: "1px solid rgba(0,240,144,0.4)",
          boxShadow: "0 0 22px rgba(0,240,144,0.18), inset 0 0 22px rgba(0,240,144,0.08)",
          opacity: 0.28,
        }}
      >
        <span aria-hidden style={{
          position: "absolute", top: -3, left: "50%", width: 6, height: 6, borderRadius: "50%",
          background: "#00f090", boxShadow: "0 0 10px 3px rgba(0,240,144,0.9)", transform: "translateX(-50%)",
        }} />
      </div>

      {/* Tight core glow — not a dome, a small halo directly behind the mesh */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: "32%", borderRadius: "50%", zIndex: 1,
          background: "radial-gradient(circle, rgba(0,204,122,0.24) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Orbiting signature nodes */}
      {enabled && [
        { color: "#00f090", size: 6, glow: "rgba(0,240,144,0.85)", inset: 0 },
        { color: "#2fd0ff", size: 5, glow: "rgba(47,208,255,0.8)", inset: 6 },
        { color: "#00cc7a", size: 4, glow: "rgba(0,204,122,0.7)", inset: -6 },
      ].map((o, i) => (
        <div key={i} aria-hidden style={{ position: "absolute", inset: o.inset, zIndex: 1, pointerEvents: "none" }}>
          <span ref={(el) => { orbitRefs.current[i] = el; }} style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center" }}>
            <span style={{
              position: "absolute", top: "4%", width: o.size, height: o.size, borderRadius: "50%",
              background: o.color, boxShadow: `0 0 10px 2px ${o.glow}`,
            }} />
          </span>
        </div>
      ))}

      {/* Drag hint */}
      {enabled && showHint && (
        <div
          aria-hidden
          className="mono xtnl-drag-hint"
          style={{
            position: "absolute", bottom: "4%", left: "50%", transform: "translateX(-50%)",
            zIndex: 3, fontSize: 9, letterSpacing: "0.14em", color: "var(--ink-2)",
            display: "flex", alignItems: "center", gap: 6, pointerEvents: "none",
            padding: "5px 11px", borderRadius: 20, background: "rgba(6,11,18,0.6)",
            border: "1px solid var(--line)",
          }}
        >
          <span style={{ fontSize: 11 }}>↔</span> DRAG TO SPIN
        </div>
      )}

      {/* The real 3D mesh */}
      <div style={{ position: "absolute", inset: 0, zIndex: 2 }}>
        {enabled && <LogoMesh3D spinRef={spinY} velocityRef={velocity} tiltRef={tilt} draggingRef={dragging} active={active} />}
      </div>

      {/* Interactive drag surface (sits above the canvas; canvas itself has pointerEvents:none) */}
      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onMouseLeave={onMouseLeaveStage}
        style={{
          position: "absolute", inset: 0, zIndex: 3,
          cursor: enabled ? "grab" : "default",
          touchAction: "none",
        }}
      />

      <style>{`
        @keyframes xtnlHintPulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
        .xtnl-drag-hint { animation: xtnlHintPulse 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
