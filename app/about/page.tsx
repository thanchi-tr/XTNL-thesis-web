import type { Metadata } from "next";
import Link from "next/link";
import ProjectTimeline from "@/components/about/ProjectTimeline";

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

/* ── Stat pill ──────────────────────────────────────────── */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "18px 24px", background: "var(--card)", border: "1px solid var(--line-hi)", borderRadius: 8 }}>
      <span className="mono" style={{ fontSize: 8.5, color: "var(--ink-3)", letterSpacing: "0.12em" }}>{label}</span>
      <span className="mono" style={{ fontSize: 20, fontWeight: 700, color: "var(--ink-0)", lineHeight: 1 }}>{value}</span>
    </div>
  );
}

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
          <h2 style={{ fontSize: "clamp(16px, 2.5vw, 22px)", fontWeight: 700, color: "var(--ink-0)", marginBottom: 20, lineHeight: 1.3 }}>
            Development History
          </h2>
          <p style={{ ...sub, maxWidth: 620, marginBottom: 36 }}>
            Five years of the trading system and the thesis web platform that documents it — scroll to
            trace the progression, or filter to a single track.
          </p>

          <ProjectTimeline />
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
