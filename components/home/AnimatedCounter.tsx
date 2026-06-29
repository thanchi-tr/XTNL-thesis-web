"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  to: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
}

export default function AnimatedCounter({ to, decimals = 0, suffix = "", prefix = "", duration = 1800 }: Props) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const pct = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - pct, 3);
            setValue(parseFloat((ease * to).toFixed(decimals)));
            if (pct < 1) requestAnimationFrame(tick);
            else setValue(to);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [to, decimals, duration]);

  return (
    <span ref={ref}>
      {prefix}{value.toFixed(decimals)}{suffix}
    </span>
  );
}
