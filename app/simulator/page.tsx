import type { Metadata } from "next";
import PublicSimulatorWrapper from "@/components/PublicSimulatorWrapper";
import Link from "next/link";

export const metadata: Metadata = { title: "Capital Simulator — Preview" };

export default function PublicSimulatorPage() {
  return (
    <div className="site-container" style={{ paddingTop: 40, paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ marginBottom: 28, maxWidth: 700 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <p className="section-eyebrow">Monte Carlo Engine</p>
          <span className="chip chip-muted" style={{ fontSize: 9 }}>PREVIEW</span>
        </div>
        <h1
          style={{
            fontSize: "clamp(22px, 4vw, 38px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--ink-0)",
            marginBottom: 14,
            lineHeight: 1.1,
          }}
        >
          Capital Simulator
        </h1>
        <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.8, maxWidth: 580 }}>
          Select a scenario to run a Monte Carlo simulation of the XTNL capital model.
          This preview shows the median outcome path with preset parameters.
          Sign in to access the full interactive workspace.
        </p>
      </div>

      {/* Notice banner */}
      <div style={{
        display: "flex", gap: 10, alignItems: "flex-start",
        padding: "12px 16px", marginBottom: 24,
        background: "rgba(240,160,48,0.04)",
        border: "1px solid rgba(240,160,48,0.14)",
        borderRadius: 8,
        maxWidth: 680,
      }}>
        <span style={{ color: "#f0a030", fontSize: 13, flexShrink: 0, marginTop: 1 }}>⚠</span>
        <p style={{ fontSize: 11, color: "rgba(240,160,48,0.75)", lineHeight: 1.65, margin: 0 }}>
          Parameters in this preview are preset and locked. Individual controls, governor variables,
          market assumptions, and distributional analytics are only available to authorised users.
        </p>
      </div>

      {/* Simulator */}
      <PublicSimulatorWrapper />

      {/* What&apos;s hidden */}
      <div
        style={{
          marginTop: 28,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 10,
          maxWidth: 700,
        }}
      >
        {[
          { label: "Locked in preview", items: ["Governor variables", "Market assumptions", "Edge parameters", "Risk sizing controls", "Scaling rules"] },
          { label: "Full workspace only", items: ["1,000-path simulation", "Percentile fan (P5–P95)", "Terminal distribution", "Analyst verdict + KPIs", "Parameter sensitivity"] },
        ].map(({ label, items }) => (
          <div
            key={label}
            className="card"
            style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}
          >
            <p style={{ fontSize: 9, letterSpacing: "0.09em", fontFamily: "var(--font-mono)", color: "rgba(142,163,190,0.45)", fontWeight: 700, textTransform: "uppercase", margin: 0 }}>
              {label}
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map(item => (
                <li key={item} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(142,163,190,0.20)", flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
        <Link href="/prospectus" className="btn btn-secondary" style={{ fontSize: 12 }}>Read the Prospectus →</Link>
        <Link href="/about"      className="btn btn-secondary" style={{ fontSize: 12 }}>About XTNL →</Link>
      </div>
    </div>
  );
}
