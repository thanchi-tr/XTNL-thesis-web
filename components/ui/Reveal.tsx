"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  delay?: number;      // ms
  threshold?: number;  // 0–1, default 0.08
  className?: string;
  style?: React.CSSProperties;
  /** "up" (default, unchanged) — translateY fade.
   *  "scale" — soft scale + fade, no vertical travel; reads more like a
   *  materialisation than a slide, used sparingly for section headers. */
  variant?: "up" | "scale";
}

const HIDDEN_TRANSFORM: Record<NonNullable<RevealProps["variant"]>, string> = {
  up: "translateY(18px)",
  scale: "scale(0.96)",
};
const SHOWN_TRANSFORM: Record<NonNullable<RevealProps["variant"]>, string> = {
  up: "translateY(0)",
  scale: "scale(1)",
};

export default function Reveal({ children, delay = 0, threshold = 0.08, className = "", style, variant = "up" }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = SHOWN_TRANSFORM[variant];
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, variant]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: 0,
        transform: HIDDEN_TRANSFORM[variant],
        transition: `opacity 0.52s cubic-bezier(0.4,0,0.2,1) ${delay}ms, transform 0.52s cubic-bezier(0.4,0,0.2,1) ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
