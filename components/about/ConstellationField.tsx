"use client";

/**
 * ConstellationField — a quiet, fixed backdrop for the whole About page: a
 * sparse network of drifting nodes that link when close, in brand green/blue
 * at very low opacity. A 2D canvas (not WebGL) so it can sit behind the
 * entire page for the cost of a hero background, not a full scene. Pauses
 * off-screen and respects prefers-reduced-motion (renders nothing at all).
 */

import { useEffect, useRef } from "react";

const N = 46;
const LINK_DIST = 130;
const SPEED = 0.09;

interface Node { x: number; y: number; vx: number; vy: number; hue: 0 | 1 }

export default function ConstellationField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const activeRef = useRef(true);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 1.75);

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (nodesRef.current.length === 0) {
        nodesRef.current = Array.from({ length: N }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * SPEED,
          vy: (Math.random() - 0.5) * SPEED,
          hue: Math.random() > 0.82 ? 1 : 0,
        }));
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const io = new IntersectionObserver(([entry]) => { activeRef.current = entry.isIntersecting; }, { threshold: 0 });
    io.observe(canvas);
    const onVis = () => { activeRef.current = activeRef.current && document.visibilityState === "visible"; };
    document.addEventListener("visibilitychange", onVis);

    const GREEN = "0,204,122";
    const BLUE = "77,156,245";

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!activeRef.current) return;
      ctx.clearRect(0, 0, w, h);
      const nodes = nodesRef.current;

      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < -20) n.x = w + 20; else if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20; else if (n.y > h + 20) n.y = -20;
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            const alpha = (1 - dist / LINK_DIST) * 0.09;
            ctx.strokeStyle = `rgba(${GREEN},${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const n of nodes) {
        ctx.fillStyle = `rgba(${n.hue ? BLUE : GREEN},0.5)`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.hue ? 1.6 : 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: "fixed", inset: 0, width: "100vw", height: "100vh",
        pointerEvents: "none", zIndex: -1,
      }}
    />
  );
}
