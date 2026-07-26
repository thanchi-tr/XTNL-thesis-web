"use client";

import { useRef, type ReactNode } from "react";

/** A key-figure tile that tilts toward the pointer, matching the mark and
 *  the founding-principle cards — every hoverable surface on the page now
 *  shares the same tactile language. */
export default function StatCard({ label, value }: { label: string; value: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(600px) rotateX(${(py * -12).toFixed(2)}deg) rotateY(${(px * 14).toFixed(2)}deg) translateZ(4px)`;
    el.style.borderColor = "rgba(0,204,122,0.4)";
    el.style.boxShadow = "0 10px 26px rgba(0,0,0,0.35), 0 0 18px rgba(0,204,122,0.12)";
  }
  function onMouseLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(600px) rotateX(0deg) rotateY(0deg) translateZ(0px)";
    el.style.borderColor = "var(--line-hi)";
    el.style.boxShadow = "none";
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{
        display: "flex", flexDirection: "column", gap: 6, padding: "18px 24px",
        background: "var(--card)", border: "1px solid var(--line-hi)", borderRadius: 8,
        transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1), border-color 0.3s, box-shadow 0.3s",
        transformStyle: "preserve-3d",
      }}
    >
      <span className="mono" style={{ fontSize: 8.5, color: "var(--ink-3)", letterSpacing: "0.12em" }}>{label}</span>
      <span className="mono" style={{ fontSize: 20, fontWeight: 700, color: "var(--ink-0)", lineHeight: 1 }}>{value}</span>
    </div>
  );
}
