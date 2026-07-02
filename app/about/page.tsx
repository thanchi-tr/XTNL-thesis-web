import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About — XTNL" };

/* ── Shared ─────────────────────────────────────────────── */
const sub = { color: "var(--ink-2)", lineHeight: 1.8, fontSize: 13.5 } as const;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mono section-eyebrow" style={{ marginBottom: 14 }}>{children}</p>
  );
}

function Divider() {
  return <div style={{ width: "100%", height: 1, background: "var(--line)", margin: "72px 0" }} />;
}

/* ── Timeline event ─────────────────────────────────────── */
interface TimelineEvent {
  period: string;
  phase?: string;
  title: string;
  items: string[];
  status?: "complete" | "active" | "queue";
}

function TimelineRow({ event, last }: { event: TimelineEvent; last?: boolean }) {
  const statusColor =
    event.status === "active"   ? "var(--green)" :
    event.status === "queue"    ? "#4d9cf5" :
    "var(--ink-3)";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "0 32px", position: "relative" }}>
      {/* Left: period chip + connector */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", paddingTop: 3 }}>
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--line-hi)",
          borderLeft: `3px solid ${statusColor}`,
          borderRadius: 5,
          padding: "6px 10px",
          textAlign: "right",
          alignSelf: "flex-end",
        }}>
          <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-0)", fontWeight: 700, letterSpacing: "0.03em", display: "block", lineHeight: 1.2 }}>
            {event.period}
          </span>
          {event.phase && (
            <span className="mono" style={{ fontSize: 8, color: statusColor, letterSpacing: "0.12em", marginTop: 4, display: "block", fontWeight: 700 }}>
              {event.phase}
            </span>
          )}
        </div>
        {/* Connector line */}
        {!last && (
          <div style={{
            flex: 1, width: 1,
            background: "var(--line)",
            margin: "10px 0 0",
            alignSelf: "center",
          }} />
        )}
      </div>

      {/* Right: content */}
      <div style={{ paddingBottom: last ? 0 : 40 }}>
        {/* Node dot */}
        <div style={{
          position: "absolute", left: 180 + 16 - 4, top: 5,
          width: 8, height: 8, borderRadius: "50%",
          background: statusColor,
          boxShadow: event.status === "active" ? `0 0 8px ${statusColor}` : "none",
          border: `1px solid ${statusColor}`,
          flexShrink: 0,
        }} />

        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-0)", marginBottom: 12, lineHeight: 1.35 }}>
          {event.title}
        </h3>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {event.items.map((item, i) => (
            <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ color: "var(--line-hi)", flexShrink: 0, marginTop: 3, fontSize: 10 }}>—</span>
              <span style={sub}>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ── Stat pill ──────────────────────────────────────────── */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "18px 24px", background: "var(--card)", border: "1px solid var(--line-hi)", borderRadius: 8 }}>
      <span className="mono" style={{ fontSize: 8.5, color: "var(--ink-3)", letterSpacing: "0.12em" }}>{label}</span>
      <span className="mono" style={{ fontSize: 20, fontWeight: 700, color: "var(--ink-0)", lineHeight: 1 }}>{value}</span>
    </div>
  );
}

/* ── Timeline data ──────────────────────────────────────── */
const TIMELINE: TimelineEvent[] = [
  {
    period: "Apr 2020 – Sep 2021",
    phase: "PRE-PHASE",
    title: "Knowledge Acquisition & Initial System Development",
    status: "complete",
    items: [
      "Six months of structured study: market structure, position sizing, risk management, and statistical evaluation of trading systems.",
      "Recognised critical limitation of initial approach: no formal testing methodology meant results were non-reproducible and selection criteria were subjective.",
      "Twelve months of systematic backtesting using Excel and manual bar-by-bar chart replay, producing a measurable first edge: mean expectancy of 0.8R per trade.",
      "Adopted Elliott wave and Fibonacci retracement as the primary entry framework for four years of live execution alongside continued backtesting.",
      "Identified a fundamental structural problem: execution outcomes were too sensitive to discretionary interpretation, making the system insufficiently deterministic for scaling.",
    ],
  },
  {
    period: "2022 – 2023",
    phase: "PHASE 0",
    title: "XTNL Framework & Scientific Sampling Methodology",
    status: "complete",
    items: [
      "Retired the Elliott/Fibonacci system. Defined a new requirement: any edge entering the XTNL pipeline must meet a minimum determinism threshold of 65%, with a clear path to 90% before live deployment.",
      "Established the XTNL phase structure: Phase 0 (SOP and edge definition) → Phase 1 (backtest and TradingView bar-by-bar replay) → Phase 2 (small account testing) → Phase 3 (seeding: four consecutive 85%+ operator score streaks required per fund injection, account below 15k) → Phase 4 (live scaling over six streaks).",
      "Any system modification resets to Phase 0. No partial re-entry permitted.",
      "Extended the statistical measurement framework beyond expectancy: T-statistic (sample reliability), Monte Carlo 95% CI (ruin risk), and SQN (quality-adjusted size).",
      "Formalised the trading plan in writing: direction selection, stop-loss management, target placement, profit locking, and entry signal criteria.",
      "Identified need to move from static 1% position sizing to dynamic risk allocation tied to system health metrics.",
    ],
  },
  {
    period: "2023",
    phase: "PHASE 1",
    title: "Backtest, Replay Testing & Statistical Validation",
    status: "complete",
    items: [
      "All backtesting conducted via TradingView bar-by-bar replay — prevents look-ahead bias by restricting the operator to one candle at a time.",
      "Pine Script firmware developed to enforce systematic entry and exit detection, reducing operator interpretation variance.",
      "Alpha test results: expectancy exceeded 1.2R per trade under controlled replay conditions.",
      "Gaussian Hidden Markov Model (GHMM) with Baum-Welch estimation and Viterbi decoding integrated into the pipeline for regime classification.",
    ],
  },
  {
    period: "2023 – 2024",
    phase: "PHASE 2",
    title: "Small Account Live Execution",
    status: "complete",
    items: [
      "System deployed on a small live account. Pipeline metrics applied to every trade in real time.",
      "Operator score tracking introduced: a per-session rating of execution quality independent of P&L outcome.",
      "Data confirmed the disconnect between edge quality in replay and live execution, motivating the infrastructure overhaul in Phase 2.5.",
    ],
  },
  {
    period: "2024 – 2025",
    phase: "PHASE 2.5",
    title: "Closed-Loop Infrastructure & Pipeline Overhaul",
    status: "complete",
    items: [
      "Closed-loop Single Source of Truth (SSoT): trade data pulled directly from broker API, eliminating manual entry and removing a class of input errors.",
      "Automated ingestion pipeline: scheduled execution every Saturday 30 minutes post-market close.",
      "OneDrive writer module built to a SOLID-compliant writable interface — structured for straightforward migration to a relational database.",
      "Manual exit detection and irrational entry detection implemented via API order-flow analysis.",
      "Full PostgreSQL migration: all historical CSV data migrated and verified.",
      "Pipeline modularised with clearly defined module boundaries. All configuration and column names passed through a central orchestrator — no local variables in any module.",
      "Institutional Stress Test (IST) sample introduced: all winning trades scaled to 88% of recorded value while losing trades remain unchanged. Provides a conservative lower-bound performance estimate.",
      "XTNL thesis web application deployed: Next.js 15, Azure Active Directory authentication, Microsoft Graph API for live report delivery, WebAuthn two-factor session guard.",
    ],
  },
  {
    period: "2025 – Present",
    phase: "PHASE 3",
    title: "Seeding Phase — Live Execution Under Operator Scoring",
    status: "active",
    items: [
      "Four consecutive sessions at 85% or above operator score required before each fund injection.",
      "Account ceiling enforced at 15k for this phase.",
      "IST sample stress-testing running in parallel with live data.",
      "Pipeline modular breakout in progress: full separation of module boundaries with a long-term persistence layer.",
    ],
  },
  {
    period: "Roadmap",
    phase: "PHASE 5+",
    title: "Regime Detection & Scale",
    status: "queue",
    items: [
      "Phase 3.5: Pipeline modular breakout — complete separation of all module boundaries, prerequisite for long-term persistence layer.",
      "Phase 4: Full live injection with scaling permitted over six consecutive operator score streaks.",
      "Phase 5: Migration to Markov Switching Autoregressive (MSAR) regime detection. Requires n > 750 live trades.",
      "Phase 6: Non-linear pattern recognition layer. Requires n > 2,500 live trades.",
      "Phase 8: Live worker process for real-time HMM inference and dynamic risk reduction.",
    ],
  },
];

/* ── Page ───────────────────────────────────────────────── */
export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section style={{ paddingTop: "calc(var(--nav-h) + 72px)", paddingBottom: 80, position: "relative", overflow: "hidden" }}>
        {/* Ambient */}
        <div aria-hidden style={{
          position: "absolute", top: 0, left: "50%",
          transform: "translateX(-50%)",
          width: "min(1400px, 140vw)", height: "60vh",
          background: "radial-gradient(ellipse at 50% -10%, rgba(0,204,122,0.055) 0%, rgba(77,156,245,0.018) 40%, transparent 66%)",
          pointerEvents: "none",
        }} />

        <div className="site-container" style={{ maxWidth: 760, position: "relative" }}>
          <Eyebrow>XTNL Solutions</Eyebrow>
          <h1 style={{
            fontSize: "clamp(28px, 5vw, 52px)",
            fontWeight: 800, letterSpacing: "-0.03em",
            color: "var(--ink-0)", lineHeight: 1.05,
            marginBottom: 24,
          }}>
            About the Project
          </h1>
          <p style={{ ...sub, fontSize: 16, maxWidth: 620 }}>
            XTNL is a systematic trading research project built on a proprietary quantitative pipeline.
            The system was developed from first principles over five years of iterative backtesting,
            statistical validation, and live execution under a formal phase-gated methodology.
          </p>
        </div>
      </section>

      {/* Key figures */}
      <section style={{ paddingBottom: 80 }}>
        <div className="site-container">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, maxWidth: 880 }}>
            <Stat label="PROJECT START" value="Apr 2020" />
            <Stat label="CURRENT PHASE" value="Phase 3" />
            <Stat label="PIPELINE MODULES" value="SSoT" />
            <Stat label="MIN. DETERMINISM" value="65%" />
            <Stat label="TARGET DETERMINISM" value="90%" />
            <Stat label="OPERATOR THRESHOLD" value="85%" />
          </div>
        </div>
      </section>

      <Divider />

      {/* Founder */}
      <section style={{ paddingBottom: 80 }}>
        <div className="site-container" style={{ maxWidth: 760 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span className="mono" style={{ fontSize: 9, fontWeight: 700, color: "var(--green)", letterSpacing: "0.16em" }}>FOUNDER</span>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
          </div>
          <h2 style={{ fontSize: "clamp(16px, 2.5vw, 22px)", fontWeight: 700, color: "var(--ink-0)", marginBottom: 24, lineHeight: 1.3 }}>
            Background
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
            {[
              ["Tertiary",  "University of Melbourne · Bachelor of Science (Computing & Software Systems)"],
              ["Domain",    "Quantitative trading, pipeline engineering, statistical methodology"],
              ["Location",  "Melbourne, VIC, Australia"],
              ["Entity",    "XTNL Solutions · ABN 96 412 697 885"],
            ].map(([label, value]) => (
              <div key={label} style={{ background: "var(--sub)", border: "1px solid var(--line)", borderRadius: 6, padding: "14px 16px" }}>
                <div className="mono" style={{ fontSize: 8.5, color: "var(--ink-3)", letterSpacing: "0.10em", marginBottom: 5 }}>{label}</div>
                <div style={{ fontSize: 13, color: "var(--ink-1)", lineHeight: 1.5 }}>{value}</div>
              </div>
            ))}
          </div>

          <p style={sub}>
            The project originated during undergraduate study in Computing and Software Systems,
            initially applying published discretionary methodologies to live markets.
            After identifying systematic weaknesses — primarily insufficient reproducibility
            and an absence of formal statistical controls — a ground-up rebuild was initiated
            under a structured phase-gated process now formalised as the XTNL Scientific
            Sampling Methodology.
          </p>
        </div>
      </section>

      <Divider />

      {/* Timeline */}
      <section style={{ paddingBottom: 100 }}>
        <div className="site-container">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span className="mono" style={{ fontSize: 9, fontWeight: 700, color: "var(--green)", letterSpacing: "0.16em" }}>PROJECT TIMELINE</span>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
          </div>
          <h2 style={{ fontSize: "clamp(16px, 2.5vw, 22px)", fontWeight: 700, color: "var(--ink-0)", marginBottom: 48, lineHeight: 1.3 }}>
            Development History
          </h2>

          <div style={{ position: "relative", maxWidth: 860 }}>
            {TIMELINE.map((event, i) => (
              <TimelineRow key={i} event={event} last={i === TIMELINE.length - 1} />
            ))}
          </div>
        </div>
      </section>

      <Divider />

      {/* CTA */}
      <section style={{ paddingBottom: 100 }}>
        <div className="site-container" style={{ maxWidth: 680 }}>
          <Eyebrow>Documentation</Eyebrow>
          <h2 style={{ fontSize: "clamp(16px, 2.5vw, 24px)", fontWeight: 700, color: "var(--ink-0)", marginBottom: 16, lineHeight: 1.3 }}>
            Further reading
          </h2>
          <p style={{ ...sub, marginBottom: 28 }}>
            The institutional prospectus covers the statistical framework, edge definitions,
            risk model, and system performance metrics in detail.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/prospectus" className="btn btn-primary" style={{ fontSize: 12, padding: "9px 22px" }}>
              Read Prospectus
            </Link>
            <Link href="/model" className="btn btn-ghost" style={{ fontSize: 12, padding: "9px 22px" }}>
              Run Simulation
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
