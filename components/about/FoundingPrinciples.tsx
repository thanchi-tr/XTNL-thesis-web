"use client";

/**
 * FoundingPrinciples — the five design decisions written down during the
 * live-trading phase, before any of them existed as code. Each is now a real,
 * shipped part of the pipeline — this section is the wishlist next to what it
 * became. Cards tilt in 3D toward the pointer (a lighter version of
 * LogoPortrait's spring-tilt, per-card via CSS custom properties so a single
 * stylesheet rule drives every card).
 */

import { useRef } from "react";

const PRINCIPLES: { mark: string; title: string; wish: string; shipped: string }[] = [
  {
    mark: "⇄",
    title: "Two-Sample Verification",
    wish: "One live sample, one master control — the live result tested against the master, never trusted alone.",
    shipped: "Every weekly run compares the session-filtered live sample against the full optimal sample and reports the divergence.",
  },
  {
    mark: "◐",
    title: "Currency Abstraction",
    wish: "Hide the dollar figure from the operator — shield the decision-maker from emotional attachment to money.",
    shipped: "The Pine Script firmware sizes every position in account-relative R; the operator's screen never shows AUD.",
  },
  {
    mark: "⊘",
    title: "Trader / Analyst Decoupling",
    wish: "Separate the person who executes from the person who reviews — even when, for now, they're the same person.",
    shipped: "Distinct operator and analyst roles are enforced in the pipeline's access model, each with a separate weekly duty.",
  },
  {
    mark: "◎",
    title: "An Unbiased Auditor",
    wish: "A referee with no stake in the outcome, to keep the system — and its founder — honest.",
    shipped: "An LLM auditor reviews weekly telemetry and operator commentary for rationalisation, independent of the trading logic.",
  },
  {
    mark: "△",
    title: "Dynamic Risk Allocation",
    wish: "Move off a static 1% risk-per-trade and let the size respond to how the system is actually performing.",
    shipped: "Recommended risk is now regime-aware — derived from Monte Carlo CVaR and the live operator efficiency score.",
  },
];

function PrincipleCard({ p }: { p: (typeof PRINCIPLES)[number] }) {
  const ref = useRef<HTMLDivElement>(null);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(700px) rotateX(${(py * -14).toFixed(2)}deg) rotateY(${(px * 16).toFixed(2)}deg) translateZ(6px)`;
    el.style.setProperty("--glow-x", `${(px + 0.5) * 100}%`);
    el.style.setProperty("--glow-y", `${(py + 0.5) * 100}%`);
    el.style.setProperty("--glow-o", "1");
  }
  function onMouseLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(700px) rotateX(0deg) rotateY(0deg) translateZ(0px)";
    el.style.setProperty("--glow-o", "0");
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className="card"
      style={{
        padding: "20px 20px 22px", display: "flex", flexDirection: "column", gap: 12,
        transition: "transform 0.35s cubic-bezier(0.16,1,0.3,1)",
        transformStyle: "preserve-3d",
        position: "relative",
        overflow: "hidden",
        ...({ "--glow-x": "50%", "--glow-y": "50%", "--glow-o": "0" } as React.CSSProperties),
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(240px circle at var(--glow-x) var(--glow-y), rgba(0,204,122,0.14), transparent 60%)",
          opacity: "var(--glow-o)",
          transition: "opacity 0.3s ease",
        } as React.CSSProperties}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
        <span
          aria-hidden
          className="mono"
          style={{
            width: 30, height: 30, borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, color: "var(--green)",
            background: "rgba(0,204,122,0.10)", border: "1px solid rgba(0,204,122,0.28)",
            flexShrink: 0,
          }}
        >
          {p.mark}
        </span>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-0)", margin: 0, lineHeight: 1.3 }}>
          {p.title}
        </h3>
      </div>

      <div style={{ position: "relative" }}>
        <span className="mono" style={{ fontSize: 8, letterSpacing: "0.1em", color: "var(--ink-3)" }}>
          THE WISH · c. 2021
        </span>
        <p style={{ fontSize: 12.5, lineHeight: 1.7, color: "var(--ink-2)", margin: "4px 0 0" }}>{p.wish}</p>
      </div>

      <div style={{ position: "relative" }}>
        <span className="mono" style={{ fontSize: 8, letterSpacing: "0.1em", color: "var(--green)" }}>
          SHIPPED
        </span>
        <p style={{ fontSize: 12.5, lineHeight: 1.7, color: "var(--ink-1)", margin: "4px 0 0" }}>{p.shipped}</p>
      </div>
    </div>
  );
}

export default function FoundingPrinciples() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
      {PRINCIPLES.map((p) => <PrincipleCard key={p.title} p={p} />)}
    </div>
  );
}
