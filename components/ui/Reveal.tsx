"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  delay?: number;      // ms
  threshold?: number;  // 0–1, default 0.08
  className?: string;
  style?: React.CSSProperties;
}

export default function Reveal({ children, delay = 0, threshold = 0.08, className = "", style }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: 0,
        transform: "translateY(18px)",
        transition: `opacity 0.52s cubic-bezier(0.4,0,0.2,1) ${delay}ms, transform 0.52s cubic-bezier(0.4,0,0.2,1) ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
