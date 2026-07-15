"use client";

/**
 * SceneAccent — drops a small decorative 3D motif into a section.
 * Lazy-loads the WebGL bundle, honours reduced-motion, and only renders while
 * the section is on-screen. Purely visual; safe to place anywhere.
 */

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { AccentVariant } from "./AccentCanvas";

const AccentCanvas = dynamic(() => import("./AccentCanvas"), { ssr: false, loading: () => null });

export default function SceneAccent({
  variant = "surface",
  size = 300,
  style,
}: {
  variant?: AccentVariant;
  size?: number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setEnabled(true);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);

  if (!enabled) return null;

  const mask = "radial-gradient(ellipse 62% 62% at 58% 46%, #000 24%, rgba(0,0,0,0.35) 58%, transparent 80%)";
  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        width: size, height: size, pointerEvents: "none",
        WebkitMaskImage: mask, maskImage: mask,
        ...style,
      }}
    >
      <AccentCanvas variant={variant} active={active} />
    </div>
  );
}
