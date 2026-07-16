"use client";

/**
 * ProjectTimeline — the About-page development history as an interactive,
 * scroll-driven timeline. A spine fills with scroll progress, nodes reveal and
 * light up as they reach the viewport, entries can be filtered (System / Web),
 * and the website's own life cycle is woven in as a parallel "web" track.
 */

import { useEffect, useRef, useState } from "react";

type Kind = "system" | "web";
type Status = "complete" | "active" | "queue";

interface TLE {
  period: string;
  phase: string;
  title: string;
  kind: Kind;
  status: Status;
  items: string[];
}

const GREEN = "#00cc7a";
const BLUE  = "#4d9cf5";

const TIMELINE: TLE[] = [
  {
    period: "Apr 2020 – Sep 2021", phase: "PRE-PHASE", kind: "system", status: "complete",
    title: "Knowledge Acquisition & Initial System Development",
    items: [
      "Six months of structured study: market structure, position sizing, risk management, and statistical evaluation of trading systems.",
      "Recognised a critical limitation: no formal testing methodology meant results were non-reproducible and selection criteria subjective.",
      "Twelve months of systematic backtesting via Excel and manual bar-by-bar replay — first measurable edge: 0.8R mean expectancy.",
      "Adopted Elliott wave / Fibonacci as the entry framework for four years of live execution alongside continued backtesting.",
      "Identified a structural problem: outcomes were too sensitive to discretionary interpretation to scale deterministically.",
    ],
  },
  {
    period: "2022 – 2023", phase: "PHASE 0", kind: "system", status: "complete",
    title: "XTNL Framework & Scientific Sampling Methodology",
    items: [
      "Retired the Elliott/Fibonacci system. New requirement: any edge must clear a 65% determinism threshold, with a path to 90% before live.",
      "Established the phase structure: Phase 0 (SOP) → 1 (backtest/replay) → 2 (small account) → 3 (seeding) → 4 (live scaling).",
      "Any system modification resets to Phase 0 — no partial re-entry permitted.",
      "Extended measurement beyond expectancy: T-statistic, Monte Carlo 95% CI, and SQN.",
      "Formalised the trading plan in writing and identified the need for dynamic risk allocation tied to system health.",
    ],
  },
  {
    period: "2023", phase: "PHASE 1", kind: "system", status: "complete",
    title: "Backtest, Replay Testing & Statistical Validation",
    items: [
      "All backtesting via TradingView bar-by-bar replay — one candle at a time prevents look-ahead bias.",
      "Pine Script firmware enforces systematic entry/exit detection, cutting operator interpretation variance.",
      "Alpha results exceeded 1.2R expectancy under controlled replay conditions.",
      "Gaussian Hidden Markov Model (Baum-Welch + Viterbi) integrated for regime classification.",
    ],
  },
  {
    period: "2023 – 2024", phase: "PHASE 2", kind: "system", status: "complete",
    title: "Small Account Live Execution",
    items: [
      "Deployed on a small live account; pipeline metrics applied to every trade in real time.",
      "Operator-score tracking introduced — execution quality rated independently of P&L.",
      "Confirmed the disconnect between replay edge and live execution, motivating an infrastructure overhaul.",
    ],
  },
  {
    period: "2024 – 2025", phase: "PHASE 2.5", kind: "system", status: "complete",
    title: "Closed-Loop Infrastructure & Pipeline Overhaul",
    items: [
      "Closed-loop Single Source of Truth: trade data pulled directly from the broker API, removing a class of input errors.",
      "Automated ingestion every Saturday, 30 minutes post-close; full migration of historical data to PostgreSQL.",
      "Pipeline modularised through a central orchestrator; Institutional Stress Test sample added as a conservative lower bound.",
    ],
  },
  {
    period: "2024", phase: "WEB · FOUNDATION", kind: "web", status: "complete",
    title: "Thesis Web Platform — Foundation",
    items: [
      "Next.js 15 (App Router) thesis application scaffolded and deployed.",
      "Microsoft Entra ID (Azure AD) sign-in, restricted to authorised work accounts.",
      "Live weekly report delivered from OneDrive via the Microsoft Graph API.",
      "WebAuthn passkey + TOTP two-factor guard on every privileged view.",
    ],
  },
  {
    period: "2025", phase: "WEB · SECURITY", kind: "web", status: "complete",
    title: "Access Control & Security Hardening",
    items: [
      "Tiered, sliding-window IP rate limiting with a system-wide flood cap in middleware.",
      "Origin-based CSRF protection on all state-mutating API routes.",
      "Role-based access control — analyst, strategist, fund-manager — gating data and controls.",
      "Server-side report caching: OneDrive pulled on demand during weekend analysis sessions.",
    ],
  },
  {
    period: "2025", phase: "WEB · TOOLING", kind: "web", status: "complete",
    title: "Live Analytics & Operator Tooling",
    items: [
      "Analytics workspace: hourly edge heatmaps, R-distribution, SQN benchmarking, and WFO validation.",
      "Session journal and focus governor — interval/focus alarm with challenge enforcement.",
      "Wear OS companion: device-code pairing, a live tile, and session status on the watch.",
      "Interactive Monte Carlo simulator with edge-decay, tax, and drawdown-halt parameters.",
    ],
  },
  {
    period: "2025 – Present", phase: "PHASE 3", kind: "system", status: "active",
    title: "Seeding Phase — Live Execution Under Operator Scoring",
    items: [
      "Four consecutive sessions at ≥ 85% operator score required before each fund injection.",
      "Account ceiling enforced at 15k for this phase.",
      "Stress-test sample running in parallel with live data.",
      "Pipeline modular breakout in progress toward a long-term persistence layer.",
    ],
  },
  {
    period: "Present", phase: "WEB · INTERACTIVE", kind: "web", status: "active",
    title: "Interactive & Immersive Layer",
    items: [
      "3D Monte Carlo probability plume hero built with Three.js / React Three Fiber.",
      "Scroll-driven camera work and a milestone inspector across the hero and this timeline.",
      "Generalised deployment and identity panels — durable copy that no longer needs manual edits.",
      "Responsive, reduced-motion-aware, and performance-gated across devices.",
    ],
  },
  {
    period: "Roadmap", phase: "PHASE 5+", kind: "system", status: "queue",
    title: "Regime Detection & Scale",
    items: [
      "Phase 4: full live injection with scaling over six consecutive operator-score streaks.",
      "Phase 5: Markov Switching Autoregressive regime detection (requires n > 750 live trades).",
      "Phase 6: non-linear pattern-recognition layer (requires n > 2,500 live trades).",
      "Phase 8: live worker for real-time HMM inference and dynamic risk reduction.",
    ],
  },
];

const FILTERS: { key: "all" | Kind; label: string }[] = [
  { key: "all",    label: "All" },
  { key: "system", label: "Trading System" },
  { key: "web",    label: "Web Platform" },
];

function Row({ e, active }: { e: TLE; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([en]) => { if (en.isIntersecting) { setShown(true); io.disconnect(); } },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const accent = e.kind === "web" ? BLUE : GREEN;
  const dim = "rgba(154,176,200,0.35)";
  const reached = shown; // node fills once revealed
  const nodeColor = e.status === "queue" && !active ? dim : accent;

  return (
    <div
      ref={ref}
      data-tl-row
      style={{
        position: "relative",
        paddingLeft: 42,
        paddingBottom: 30,
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(18px)",
        transition: "opacity 0.5s ease, transform 0.6s cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      {/* node */}
      <span
        data-tl-node
        aria-hidden
        style={{
          position: "absolute", left: 5, top: 3,
          width: 15, height: 15, borderRadius: "50%",
          background: reached ? nodeColor : "var(--base)",
          border: `2px solid ${reached ? nodeColor : "var(--line-hi)"}`,
          boxShadow: active ? `0 0 0 4px ${accent}22, 0 0 14px ${accent}` : "none",
          transform: active ? "scale(1.25)" : "scale(1)",
          transition: "all 0.3s cubic-bezier(0.22,1,0.36,1)",
        }}
      />

      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-0)", letterSpacing: "0.02em" }}>
          {e.period}
        </span>
        <span className="mono" style={{
          fontSize: 8, fontWeight: 700, letterSpacing: "0.12em",
          padding: "2px 7px", borderRadius: 5,
          color: accent, background: `${accent}14`, border: `1px solid ${accent}33`,
        }}>
          {e.phase}
        </span>
        {e.status === "active" && (
          <span className="mono" style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", color: accent }}>
            ● IN PROGRESS
          </span>
        )}
      </div>

      <h3 style={{
        fontSize: 15.5, fontWeight: 600, color: active ? "var(--ink-0)" : "var(--ink-1)",
        marginBottom: 12, lineHeight: 1.35, transition: "color 0.3s",
      }}>
        {e.title}
      </h3>

      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {e.items.map((it, k) => (
          <li key={k} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ color: `${accent}99`, flexShrink: 0, marginTop: 6, width: 4, height: 4, borderRadius: "50%", background: `${accent}99` }} />
            <span style={{ color: "var(--ink-2)", lineHeight: 1.75, fontSize: 13.5 }}>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ProjectTimeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [activeIdx, setActiveIdx] = useState(0);
  const [reduce, setReduce] = useState(false);

  const rows = TIMELINE.filter(e => filter === "all" || e.kind === filter);

  useEffect(() => {
    setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const c = containerRef.current;
      if (!c) return;
      const rect = c.getBoundingClientRect();
      const anchor = window.innerHeight * 0.42;
      // progress fill
      const filled = Math.max(0, Math.min(rect.height, anchor - rect.top));
      if (fillRef.current) fillRef.current.style.height = `${filled}px`;
      // active node = last one whose center has passed the anchor
      const nodes = c.querySelectorAll<HTMLElement>("[data-tl-row]");
      let act = 0;
      nodes.forEach((n, idx) => {
        if (n.getBoundingClientRect().top <= anchor) act = idx;
      });
      setActiveIdx(prev => (prev === act ? prev : act));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [filter]);

  const activeEntry = rows[activeIdx];

  return (
    <div>
      {/* Controls + live phase indicator */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
        <div style={{ display: "inline-flex", background: "var(--sub)", border: "1px solid var(--line)", borderRadius: 10, padding: 3 }}>
          {FILTERS.map(f => {
            const on = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className="mono"
                style={{
                  padding: "6px 13px", borderRadius: 8, cursor: "pointer", border: "none",
                  fontSize: 10, letterSpacing: "0.04em", fontWeight: 600,
                  background: on ? "rgba(0,204,122,0.14)" : "transparent",
                  color: on ? "var(--green)" : "var(--ink-3)",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {activeEntry && (
          <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
            <span className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em" }}>VIEWING</span>
            <span className="mono" style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em",
              padding: "3px 9px", borderRadius: 6,
              color: activeEntry.kind === "web" ? BLUE : GREEN,
              background: `${activeEntry.kind === "web" ? BLUE : GREEN}14`,
              border: `1px solid ${activeEntry.kind === "web" ? BLUE : GREEN}33`,
              whiteSpace: "nowrap",
            }}>
              {activeEntry.phase}
            </span>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div ref={containerRef} style={{ position: "relative", maxWidth: 780 }}>
        {/* spine (dim) */}
        <div aria-hidden style={{ position: "absolute", left: 11, top: 8, bottom: 24, width: 2, background: "var(--line-hi)", borderRadius: 2 }} />
        {/* spine fill (scroll progress) */}
        <div ref={fillRef} aria-hidden style={{
          position: "absolute", left: 11, top: 8, width: 2, height: reduce ? "100%" : 0,
          background: "linear-gradient(180deg, #00cc7a 0%, #4d9cf5 100%)",
          borderRadius: 2, boxShadow: "0 0 10px rgba(0,204,122,0.5)",
          willChange: "height",
        }} />

        {rows.map((e, i) => (
          <Row key={`${filter}-${e.phase}`} e={e} active={i === activeIdx} />
        ))}
      </div>
    </div>
  );
}
