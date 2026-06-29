import type { Metadata } from "next";
import SimulatorWrapper from "@/components/SimulatorWrapper";
import Link from "next/link";

export const metadata: Metadata = { title: "Interactive Simulator" };

export default function ModelPage() {
  return (
    <div className="site-container" style={{ paddingTop: 40, paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ marginBottom: 28, maxWidth: 760 }}>
        <p className="section-eyebrow" style={{ marginBottom: 12 }}>Monte Carlo Engine</p>
        <h1
          style={{
            fontSize: "clamp(22px, 4vw, 40px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--ink-0)",
            marginBottom: 14,
            lineHeight: 1.1,
          }}
        >
          Interactive Capital Simulator
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.8, maxWidth: 640 }}>
          1,000-iteration Monte Carlo engine with a realistic Ornstein-Uhlenbeck operator model.
          Adjust parameters live — the probability distribution of outcomes updates immediately.
        </p>
      </div>

      {/* Model spec callout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 10,
          marginBottom: 20,
        }}
      >
        {[
          {
            title: "OU Operator Model",
            chip: "chip-green",
            body: "Efficiency fluctuates via an Ornstein-Uhlenbeck process (θ=0.35, σ=7.5%). Shocks persist ~3 weeks before normalising — capturing realistic human performance autocorrelation.",
          },
          {
            title: "Performance-Gated Risk",
            chip: "chip-blue",
            body: "Position size = base_r × perf_mult(eff) × regime_penalty(streak) × 0.95. Efficiency tier directly gates the risk multiplier each week.",
          },
          {
            title: "Five Adversarial Frictions",
            chip: "chip-muted",
            body: "Slippage on positive weeks, edge decay per quarter, ATO taxation annually, 4-week capital injection gate, and configurable drawdown halt threshold.",
          },
        ].map(({ title, chip, body }) => (
          <div key={title} className="card" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            <span className={`chip ${chip}`} style={{ alignSelf: "flex-start" }}>{title}</span>
            <p style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.7 }}>{body}</p>
          </div>
        ))}
      </div>

      {/* Simulator — lazy-loaded via SimulatorWrapper (client component with ssr:false) */}
      <SimulatorWrapper />

      {/* Methodology note */}
      <div className="card" style={{ padding: 22, marginTop: 20 }}>
        <p className="section-eyebrow" style={{ marginBottom: 12 }}>Simulation Methodology</p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 14,
            fontSize: 12.5,
            color: "var(--ink-2)",
            lineHeight: 1.75,
          }}
        >
          <p><strong style={{ color: "var(--ink-1)" }}>OU Operator:</strong>{" "}
            eff[t+1] = eff[t] + 0.35·(μ − eff[t]) + 0.075·Z, clamped to [40%, 100%].
            θ=0.35 means shocks persist ~3 weeks before normalising.</p>
          <p><strong style={{ color: "var(--ink-1)" }}>Risk gating:</strong>{" "}
            applied_risk = base_r × perf_mult(eff) × regime_penalty(streak) × 0.95.
            Mirrors recommend_r_generator.py exactly.</p>
          <p><strong style={{ color: "var(--ink-1)" }}>Weekly compounding:</strong>{" "}
            Position size = equity_start × applied_risk (fixed for the week).
            equity_end = equity_start × (1 + applied_risk × captured_weekly_R).</p>
          <p><strong style={{ color: "var(--ink-1)" }}>Commission:</strong>{" "}
            Deducted when eff ≥ 88% and after commissionStartWeek.
            Formula: (base_r × 0.20 + max(yield, 0) × 0.05) × [1.5 if eff ≥ 95%].</p>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
        <Link href="/data"       className="btn btn-secondary" style={{ fontSize: 12 }}>View the Data →</Link>
        <Link href="/prospectus" className="btn btn-secondary" style={{ fontSize: 12 }}>Read the Prospectus →</Link>
      </div>
    </div>
  );
}
