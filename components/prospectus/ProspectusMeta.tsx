"use client";

/**
 * ProspectusMeta — the identity / system fact grid on the prospectus cover.
 *
 * Values are DURABLE by design: no dataset counts, firmware versions, or
 * determinism percentages that drift and force page edits. Only stable identity
 * facts and qualitative system descriptors, so the page stays correct over time.
 *
 * A subtle scroll-linked camera tilt (rotateX) + staggered entry give the block
 * fluency without distracting from the content. Reduced-motion falls back flat.
 */

import { useEffect, useRef, useState } from "react";

const META: { label: string; value: string; accent?: boolean }[] = [
  { label: "Entity",            value: "XTNL Solutions", accent: true },
  { label: "ABN",               value: "96 412 697 885" },
  { label: "Market",            value: "Spot FX · EUR / USD" },
  { label: "Execution System",  value: "Deterministic firmware" },
  { label: "Determinism",       value: "Code-enforced automation" },
  { label: "Validation",        value: "Walk-forward · out-of-sample" },
  { label: "Deployment",        value: "Live · governor-controlled" },
  { label: "Operational Locus", value: "Clayton South, VIC · Australia" },
];

export default function ProspectusMeta() {
  const wrapRef  = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [shown, setShown]   = useState(false);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  /* staggered entry reveal */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* scroll-linked camera tilt — the block leans as it passes through the viewport */
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = wrapRef.current, inner = innerRef.current;
      if (!el || !inner) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const center = r.top + r.height / 2;
      const p = Math.max(-1, Math.min(1, (vh / 2 - center) / (vh / 2 + r.height / 2)));
      inner.style.transform = `rotateX(${(-p * 4.2).toFixed(2)}deg) translateY(${(p * 7).toFixed(1)}px)`;
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
  }, [reduce]);

  return (
    <div ref={wrapRef} style={{ perspective: 1500 }}>
      <style>{`
        .pm-card { transition: opacity 0.5s ease, transform 0.55s cubic-bezier(0.22,1,0.36,1), border-color 0.2s ease, box-shadow 0.2s ease; }
        .pm-card:hover {
          border-color: rgba(0,204,122,0.42) !important;
          box-shadow: 0 12px 34px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,204,122,0.10);
          transform: translateY(-3px) !important;
        }
      `}</style>

      <div
        ref={innerRef}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(208px, 1fr))",
          gap: 10,
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
      >
        {META.map((m, i) => {
          const ready = shown || reduce;
          return (
            <div
              key={m.label}
              className="pm-card"
              style={{
                position: "relative",
                background: "linear-gradient(158deg, var(--raised) 0%, var(--card) 62%)",
                border: "1px solid var(--line-hi)",
                borderRadius: 12,
                padding: "15px 16px 17px",
                overflow: "hidden",
                opacity: ready ? 1 : 0,
                transform: ready ? "translateY(0)" : "translateY(16px)",
                transitionDelay: reduce ? "0ms" : `${i * 55}ms`,
              }}
            >
              {/* top accent bar */}
              <span
                aria-hidden
                style={{
                  position: "absolute", top: 0, left: 0, height: 2,
                  width: m.accent ? "100%" : 30,
                  background: m.accent
                    ? "linear-gradient(90deg, var(--green) 0%, rgba(0,204,122,0) 90%)"
                    : "var(--green)",
                  opacity: m.accent ? 0.85 : 0.5,
                }}
              />
              <span
                className="mono"
                style={{
                  display: "block", fontSize: 9, letterSpacing: "0.14em",
                  textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 9,
                }}
              >
                {m.label}
              </span>
              <span
                className="mono"
                style={
                  m.accent
                    ? {
                        fontSize: 15, fontWeight: 700, lineHeight: 1.35,
                        background: "linear-gradient(180deg, #eef2f8 10%, #7df0b0 150%)",
                        WebkitBackgroundClip: "text", backgroundClip: "text",
                        WebkitTextFillColor: "transparent", color: "transparent",
                      }
                    : { fontSize: 12, fontWeight: 700, lineHeight: 1.4, color: "var(--green)" }
                }
              >
                {m.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
