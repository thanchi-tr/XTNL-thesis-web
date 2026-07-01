import { redirect } from "next/navigation";
import Link from "next/link";
import AnimatedCounter from "@/components/home/AnimatedCounter";
import FiveQuestions from "@/components/home/FiveQuestions";
import Reveal from "@/components/ui/Reveal";

/* ─── helpers ─────────────────────────────────────────────── */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="section-eyebrow" style={{ marginBottom: 14 }}>{children}</p>;
}

function Divider() {
  return <div style={{ width: "100%", height: 1, background: "var(--line)", margin: "80px 0" }} />;
}

function PillarCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="card card-hover" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="mono" style={{ fontSize: 10, color: "var(--green)", fontWeight: 700, letterSpacing: "0.14em" }}>
          {n}
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-0)", lineHeight: 1.4 }}>{title}</p>
      <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.75, flex: 1 }}>{body}</p>
    </div>
  );
}

/* ─── page ────────────────────────────────────────────────── */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (error) redirect(`/sign-error?error=${encodeURIComponent(error)}`);

  return (
    <>

      {/* ══ HERO ═══════════════════════════════════════════════ */}
      <section
        style={{
          minHeight: "calc(92vh - var(--nav-h))",
          display: "flex",
          alignItems: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ambient glow — wide upper bloom */}
        <div aria-hidden style={{
          position: "absolute",
          top: 0, left: "50%",
          transform: "translateX(-50%)",
          width: "min(1600px, 160vw)",
          height: "72vh",
          background: "radial-gradient(ellipse at 50% -8%, rgba(0,204,122,0.072) 0%, rgba(0,185,255,0.022) 36%, transparent 66%)",
          pointerEvents: "none",
        }} />
        {/* Dot grid — fades downward */}
        <div aria-hidden style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.038) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
          WebkitMaskImage: "radial-gradient(ellipse 88% 68% at 50% 0%, black 0%, transparent 100%)",
          maskImage: "radial-gradient(ellipse 88% 68% at 50% 0%, black 0%, transparent 100%)",
          pointerEvents: "none",
        }} />

        <div className="site-container" style={{ paddingTop: 48, paddingBottom: 72 }}>
          <div style={{ maxWidth: 820 }}>
            <p className="section-eyebrow fade-up" style={{ marginBottom: 22 }}>
              XTNL Solutions · Thesis Document
            </p>

            <h1
              className="fade-up fade-up-1"
              style={{
                fontSize: "clamp(30px, 4.5vw, 60px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                color: "var(--ink-0)",
                marginBottom: 28,
              }}
            >
              Building Legacy Through{" "}
              <span style={{ color: "var(--green)", textShadow: "0 0 48px rgba(0,204,122,0.32)" }}>Systematic Arbitrage.</span>
            </h1>

            <p
              className="fade-up fade-up-2"
              style={{
                fontSize: "clamp(15px, 1.8vw, 18px)",
                color: "var(--ink-1)",
                lineHeight: 1.8,
                maxWidth: 660,
                marginBottom: 44,
              }}
            >
              XTNL is a quantitative research and execution framework built on the thesis that
              statistical inefficiencies in financial markets, captured with rigorous discipline
              and compounded over time, constitute a credible path to building durable,
              generational wealth.
            </p>

            <div className="fade-up fade-up-2" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href="/prospectus" className="btn btn-primary" style={{ fontSize: 13, padding: "13px 28px" }}>
                Read the Thesis
              </Link>
              <Link href="/model" className="btn btn-secondary" style={{ fontSize: 13, padding: "12px 28px" }}>
                Explore the Model
              </Link>
              <Link href="/data" className="btn btn-secondary" style={{ fontSize: 13, padding: "12px 28px" }}>
                View the Data
              </Link>
            </div>

            {/* Pulse metrics */}
            <div
              className="fade-up fade-up-3"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px 40px",
                marginTop: 60,
                paddingTop: 36,
                borderTop: "1px solid rgba(0,204,122,0.14)",
              }}
            >
              {[
                { label: "Primary Dataset (N)",    val: <><AnimatedCounter to={106} duration={1600} /></>,      sub: "Session-filtered sample" },
                { label: "Full Optimal Dataset",   val: <><AnimatedCounter to={308} duration={1800} /></>,      sub: "Forward-test universe" },
                { label: "SQN — Primary Core",     val: <><AnimatedCounter to={4.253} decimals={3} duration={2000} /></>, sub: "System quality number" },
                { label: "OOS Expectancy",         val: <>+<AnimatedCounter to={0.904} decimals={3} duration={2200} /> R</>, sub: "Walk-forward validated" },
              ].map(({ label, val, sub }) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span className="label-xs">{label}</span>
                  <span className="mono" style={{ fontSize: 22, fontWeight: 700, color: "var(--ink-0)", lineHeight: 1.1 }}>{val}</span>
                  <span style={{ fontSize: 10, color: "var(--ink-3)" }}>{sub}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ PURPOSE ════════════════════════════════════════════ */}
      <section style={{ background: "var(--sub)", paddingTop: 80, paddingBottom: 80 }}>
        <div className="site-container">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 48,
              alignItems: "start",
            }}
          >
            <div>
              <Eyebrow>The Objective</Eyebrow>
              <h2
                style={{
                  fontSize: "clamp(22px, 3vw, 34px)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: "var(--ink-0)",
                  marginBottom: 20,
                  lineHeight: 1.25,
                }}
              >
                Systematic arbitrage as a vehicle for legacy formation
              </h2>
              <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.8, marginBottom: 16 }}>
                The primary role of the XTNL entity is to construct a lasting financial legacy
                through the systematic arbitrage of quantifiable, statistically verified
                inefficiencies in the foreign exchange market.
              </p>
              <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.8 }}>
                This is not a speculative venture. The business operates on a single, non-negotiable
                premise: every unit of capital deployed must be justified by a proven statistical
                edge, sized by a risk model derived from that edge, and audited continuously against
                live performance.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                {
                  chip: "chip-green",
                  label: "Arbitrage",
                  body: "The systematic capture of recurring, statistically verifiable pricing inefficiencies in the EUR/USD spot market.",
                },
                {
                  chip: "chip-blue",
                  label: "Compounding",
                  body: "Disciplined reinvestment of realised returns, sized precisely against a risk model derived from Monte Carlo tail-risk analysis.",
                },
                {
                  chip: "chip-muted",
                  label: "Legacy",
                  body: "The long-horizon objective: a self-sustaining compounding architecture that outlasts any single market regime or edge lifecycle.",
                },
              ].map(({ chip, label, body }) => (
                <div
                  key={label}
                  className="card"
                  style={{ padding: "18px 20px", display: "flex", gap: 16, alignItems: "flex-start" }}
                >
                  <span className={`chip ${chip}`} style={{ marginTop: 2, flexShrink: 0 }}>{label}</span>
                  <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.7 }}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ THE FIVE QUESTIONS ══════════════════════════════════ */}
      <section style={{ paddingTop: 80, paddingBottom: 80 }}>
        <div className="site-container">
          <Eyebrow>Research Framework</Eyebrow>
          <h2
            style={{
              fontSize: "clamp(22px, 3vw, 34px)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--ink-0)",
              marginBottom: 14,
              maxWidth: 640,
              lineHeight: 1.25,
            }}
          >
            The five questions this thesis is designed to answer
          </h2>
          <p style={{ fontSize: 15, color: "var(--ink-2)", maxWidth: 600, marginBottom: 48, lineHeight: 1.8 }}>
            Every component of the XTNL system — the statistical models, the risk engine, the
            execution architecture, the walk-forward validation — exists to answer one or more
            of the following questions with empirical rigour.
          </p>
          <FiveQuestions />
        </div>
      </section>

      {/* ══ ARCHITECTURE PILLARS ════════════════════════════════ */}
      <section style={{ background: "var(--sub)", paddingTop: 80, paddingBottom: 80 }}>
        <div className="site-container">
          <Eyebrow>System Architecture</Eyebrow>
          <h2
            style={{
              fontSize: "clamp(22px, 3vw, 34px)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--ink-0)",
              marginBottom: 14,
              lineHeight: 1.25,
            }}
          >
            Four structural pillars
          </h2>
          <p style={{ fontSize: 15, color: "var(--ink-2)", maxWidth: 600, marginBottom: 48, lineHeight: 1.8 }}>
            The XTNL architecture is deliberately decoupled into distinct layers, ensuring that
            no single component — including the edge itself — can compromise the integrity of the whole.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            <PillarCard
              n="01"
              title="The Statistical Engine"
              body="A multi-dimensional analytics pipeline that computes SQN, expectancy, CVaR, walk-forward OOS metrics, and regime labels across 14 distinct data subsets — continuously auditing the health of the underlying edge."
            />
            <PillarCard
              n="02"
              title="The Risk Architecture"
              body="Position sizing derived entirely from a Monte Carlo Conditional Value at Risk (CVaR) model. Risk allocation is not fixed — it is dynamically computed from the tail-risk distribution of the edge's own historical outcomes."
            />
            <PillarCard
              n="03"
              title="The Execution Layer"
              body="A deterministic, firmware-level execution system that removes the human operator from real-time capital decisions. The operator provides coordinates; the firmware determines sizing and executes without discretionary override."
            />
            <PillarCard
              n="04"
              title="IP / Infrastructure Decoupling"
              body="The infrastructure chassis — analytics, risk engine, execution firmware — is permanently owned and continuously refined. The intellectual property (the specific edge) is treated as a replaceable payload, isolated so that edge decay never corrupts the architecture."
            />
          </div>
        </div>
      </section>

      {/* ══ CURRENT STATE ═══════════════════════════════════════ */}
      <section style={{ paddingTop: 80, paddingBottom: 80 }}>
        <div className="site-container">
          <Eyebrow>Deployment Status</Eyebrow>
          <h2
            style={{
              fontSize: "clamp(22px, 3vw, 34px)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--ink-0)",
              marginBottom: 14,
              lineHeight: 1.25,
              maxWidth: 600,
            }}
          >
            Where the system stands
          </h2>
          <p style={{ fontSize: 15, color: "var(--ink-2)", maxWidth: 620, marginBottom: 44, lineHeight: 1.8 }}>
            XTNL operates across multiple data universes with different validation statuses.
            The figures below represent the current state of the production system as reported
            by the analytics pipeline.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 12,
            }}
          >
            {[
              {
                title: "SESSION_FILTERED — Primary Core",
                chip: "chip-green", chipLabel: "ELITE · SQN 4.253",
                rows: [
                  ["Sample Size", "N = 106"],
                  ["Expectancy (μ)", "0.982 R"],
                  ["95% CI Lower", "0.529 R"],
                  ["Profit Factor", "3.109×"],
                  ["WFO OOS Status", "STABLE"],
                  ["OOS Expectancy", "0.904 R"],
                ],
              },
              {
                title: "FULL_OPTIMAL — Aggregate Universe",
                chip: "chip-green", chipLabel: "SUPERB · SQN 5.211",
                rows: [
                  ["Sample Size", "N = 308"],
                  ["Expectancy (μ)", "0.693 R"],
                  ["95% CI Lower", "0.432 R"],
                  ["Profit Factor", "2.39×"],
                  ["WFO OOS Status", "ELITE"],
                  ["OOS Expectancy", "0.774 R"],
                ],
              },
              {
                title: "LIVE Execution — Current Deploy",
                chip: "chip-amber", chipLabel: "CAUTION · SQN 0.064",
                rows: [
                  ["Live Trade Count", "N = 29"],
                  ["Expectancy (μ)", "0.027 R"],
                  ["95% CI Lower", "−0.787 R"],
                  ["Profit Factor", "1.033×"],
                  ["WFO Status", "INSUFFICIENT DATA"],
                  ["Note", "Early-stage accumulation"],
                ],
              },
            ].map(({ title, chip, chipLabel, rows }) => (
              <div key={title} className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <p className="mono" style={{ fontSize: 11, color: "var(--ink-2)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{title}</p>
                  <span className={`chip ${chip}`} style={{ alignSelf: "flex-start" }}>{chipLabel}</span>
                </div>
                <div>
                  {rows.map(([k, v]) => (
                    <div
                      key={k}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "7px 0",
                        borderBottom: "1px solid var(--line)",
                        gap: 12,
                      }}
                    >
                      <span style={{ fontSize: 12, color: "var(--ink-2)" }}>{k}</span>
                      <span className="mono" style={{ fontSize: 12, color: "var(--ink-0)", fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div
            className="card"
            style={{ marginTop: 16, padding: "14px 20px", borderLeft: "3px solid var(--amber)" }}
          >
            <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.7 }}>
              <strong style={{ color: "var(--amber)" }}>Note on live vs. forward-test data:</strong>{" "}
              The SESSION_FILTERED (N=106) and FULL_OPTIMAL (N=308) datasets span the full
              forward-test execution period. The LIVE sample (N=29) represents actual capital-at-risk
              trades in the current deployment phase. A small live N at CAUTION status is expected
              at this stage of the deployment lifecycle — statistically, 29 trades is insufficient
              to make probabilistic claims about live performance.
            </p>
          </div>
        </div>
      </section>

      {/* ══ AGENCY PROBLEM ══════════════════════════════════════ */}
      <section style={{ paddingTop: 80, paddingBottom: 80 }}>
        <div className="site-container">
          <Eyebrow>Governance</Eyebrow>
          <h2
            style={{
              fontSize: "clamp(22px, 3vw, 34px)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--ink-0)",
              marginBottom: 14,
              lineHeight: 1.25,
              maxWidth: 640,
            }}
          >
            The agency problem is the core risk in any managed business
          </h2>
          <p style={{ fontSize: 15, color: "var(--ink-2)", maxWidth: 620, marginBottom: 48, lineHeight: 1.8 }}>
            When the person managing capital has different incentives from the person who owns it,
            interests diverge. XTNL treats this as an engineering problem — every misalignment
            vector is addressed with a deterministic, code-enforced constraint. The operator is
            not trusted. They are measured.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
              marginBottom: 28,
            }}
          >
            {[
              {
                title: "Commission gating",
                body: "The operator earns zero commission if execution efficiency drops below 88% or if they miss more than 25% of qualified opportunities. Profitability alone does not qualify — quality of execution is the gate.",
                accent: "var(--green)",
              },
              {
                title: "Performance-gated risk",
                body: "Position sizes are algorithmically tied to the operator's demonstrated efficiency score. Below 80%, sizes are cut to 60%. Below 40%, the system halts. These are firmware constraints — not policies the operator can override.",
                accent: "var(--blue)",
              },
              {
                title: "Capital lock mechanism",
                body: "Fresh capital is not injected unconditionally. The system requires three consecutive weeks of ≥ 88% efficiency before unlocking the capital pool. A single poor week resets the streak to zero.",
                accent: "var(--amber)",
              },
              {
                title: "Lucky trade isolation",
                body: "The system explicitly identifies trades where the outcome was good despite poor execution. These are flagged as 'lucky' and excluded from efficiency calculations — the operator does not benefit from accidental profit.",
                accent: "var(--red)",
              },
            ].map(({ title, body, accent }) => (
              <div
                key={title}
                className="card card-hover"
                style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12, borderLeft: `3px solid ${accent}30` }}
              >
                <div style={{ width: 20, height: 2, background: accent, borderRadius: 1 }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-0)", lineHeight: 1.4 }}>{title}</p>
                <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.75, flex: 1 }}>{body}</p>
              </div>
            ))}
          </div>

          <div
            className="card"
            style={{
              padding: "20px 24px",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 20,
            }}
          >
            <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.7, maxWidth: 560 }}>
              A third governance layer — a large language model auditor — reads the weekly
              performance report and produces a qualitative assessment that no statistical model
              can replicate: detecting narrative inconsistency, identifying rationalisation patterns,
              and flagging commentary that contradicts the observable data.
            </p>
            <Link href="/prospectus#s12" className="btn btn-secondary" style={{ flexShrink: 0, fontSize: 12 }}>
              Read the full governance architecture →
            </Link>
          </div>
        </div>
      </section>

      {/* ══ NAVIGATE ════════════════════════════════════════════ */}
      <section style={{ background: "var(--sub)", paddingTop: 64, paddingBottom: 80 }}>
        <div className="site-container">
          <Eyebrow>Explore</Eyebrow>
          <h2
            style={{
              fontSize: "clamp(20px, 2.5vw, 30px)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--ink-0)",
              marginBottom: 36,
              lineHeight: 1.3,
            }}
          >
            Continue into the thesis
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {[
              {
                href: "/prospectus",
                label: "Institutional Prospectus",
                sub: "Full 11-section technical thesis covering statistical validation, architecture, risk models, and capital scaling.",
                chip: "chip-blue", chipLabel: "Technical",
              },
              {
                href: "/model",
                label: "Interactive Simulator",
                sub: "1,000-iteration Monte Carlo engine. Adjust every parameter — edge decay, tax, capital injection, drawdown halt — in real time.",
                chip: "chip-green", chipLabel: "Interactive",
              },
              {
                href: "/data",
                label: "System Data",
                sub: "All production metrics, R-distribution charts, hourly performance heatmap, SQN benchmarking, and WFO validation tables.",
                chip: "chip-muted", chipLabel: "Analytics",
              },
            ].map(({ href, label, sub, chip, chipLabel }) => (
              <Link
                key={href}
                href={href}
                className="card card-hover"
                style={{
                  padding: 28,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  textDecoration: "none",
                }}
              >
                <span className={`chip ${chip}`} style={{ alignSelf: "flex-start" }}>{chipLabel}</span>
                <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-0)" }}>{label}</p>
                <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.7, flex: 1 }}>{sub}</p>
                <span className="mono" style={{ fontSize: 11, color: "var(--green)", letterSpacing: "0.08em" }}>
                  Read →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Divider />
    </>
  );
}
