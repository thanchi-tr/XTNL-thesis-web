"use client";

/**
 * ScrollDivider — the About page's section rule, but drawn in from the
 * center on scroll (width 0 -> 100%) instead of just sitting there static.
 * Kept a separate client component (page.tsx is a Server Component exporting
 * metadata) so the rest of the page stays server-rendered.
 */

import { useEffect, useRef } from "react";

export default function ScrollDivider() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.transform = "scaleX(1)";
      el.style.opacity = "1";
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.transform = "scaleX(1)";
          el.style.opacity = "1";
          obs.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div style={{ width: "100%", margin: "72px 0", position: "relative" }}>
      <div
        ref={ref}
        className="xtnl-divider-glow"
        style={{
          width: "100%",
          height: 1,
          background: "var(--line)",
          transform: "scaleX(0)",
          opacity: 0,
          transformOrigin: "center",
          transition: "transform 0.9s cubic-bezier(0.4,0,0.2,1), opacity 0.9s ease",
        }}
      />
    </div>
  );
}
