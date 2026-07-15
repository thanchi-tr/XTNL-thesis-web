import { redirect } from "next/navigation";
import Link from "next/link";
import FiveQuestions from "@/components/home/FiveQuestions";
import Reveal from "@/components/ui/Reveal";
import HeroBackground from "@/components/hero/HeroBackground";
import SceneAccent from "@/components/hero/SceneAccent";

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
          background: "radial-gradient(ellipse at 50% -8%, rgba(0,204,122,0.09) 0%, rgba(0,185,255,0.03) 36%, transparent 66%)",
          pointerEvents: "none",
        }} />
        {/* Dot grid — fades downward */}
        <div aria-hidden style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
          WebkitMaskImage: "radial-gradient(ellipse 88% 68% at 50% 0%, black 0%, transparent 100%)",
          maskImage: "radial-gradient(ellipse 88% 68% at 50% 0%, black 0%, transparent 100%)",
          pointerEvents: "none",
        }} />

        {/* 3D Monte Carlo probability plume (client, lazy, reduced-motion aware) */}
        <HeroBackground />

        {/* Left legibility scrim — keeps copy crisp, leaves the plume vivid on the right */}
        <div aria-hidden style={{
          position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
          background: "linear-gradient(90deg, var(--base) 0%, rgba(4,8,15,0.9) 30%, rgba(4,8,15,0.66) 48%, rgba(4,8,15,0.2) 66%, transparent 82%)",
        }} />

        <div className="site-container" style={{ paddingTop: 48, paddingBottom: 72, position: "relative", zIndex: 2 }}>
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
              <span style={{
                background: "linear-gradient(104deg, #00f090 0%, #00cc7a 40%, #7df0b0 64%, #f0c874 100%)",
                WebkitBackgroundClip: "text", backgroundClip: "text",
                WebkitTextFillColor: "transparent", color: "transparent",
                filter: "drop-shadow(0 0 42px rgba(0,204,122,0.35))",
              }}>Systematic Arbitrage.</span>
            </h1>

            <p
              className="fade-up fade-up-2"
              style={{
                fontSize: "clamp(15px, 1.8vw, 18px)",
                color: "var(--ink-1)",
                lineHeight: 1.8,
                maxWidth: 660,
                marginBottom: 44,
                textShadow: "0 1px 16px rgba(4,8,15,0.95), 0 0 30px rgba(4,8,15,0.7)",
              }}
            >
              XTNL is a quantitative research and execution framework built on a single thesis:
              that statistical inefficiencies in financial markets — captured by a proven edge,
              sized by a deterministic risk governor, and compounded under enforced discipline —
              constitute a credible path to building durable, generational wealth.
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
                { label: "Risk Governor",     val: <>Active</>,                                                        sub: "Code-enforced discipline" },
                { label: "Validation",        val: <>Walk-Forward</>,                                                  sub: "Out-of-sample confirmed" },
                { label: "Edge Quality",      val: <>SQN&nbsp;4+</>,   sub: "Elite band, forward-tested" },
                { label: "Expectancy Floor",  val: <>≥&nbsp;0.5&nbsp;R</>, sub: "95% confidence lower bound" },
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
      <section style={{ background: "var(--sub)", paddingTop: 80, paddingBottom: 80, position: "relative", overflow: "hidden" }}>
        <SceneAccent
          variant="surface"
          size={680}
          style={{ position: "absolute", top: -90, right: "clamp(-240px, -13vw, -90px)", opacity: 0.42, zIndex: 0 }}
        />
        <div className="site-container" style={{ position: "relative", zIndex: 1 }}>
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
            XTNL runs a proven statistical edge inside a deterministic risk governor. The panels
            below summarise each universe&apos;s validation posture and the governance state that
            controls live capital — not point-in-time performance, which the analytics pipeline
            audits continuously.
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
                chip: "chip-green", chipLabel: "ELITE · SQN 4+",
                rows: [
                  ["Validation", "Walk-forward OOS"],
                  ["Expectancy Floor", "≥ 0.5 R (95% CI)"],
                  ["Edge Quality", "Elite band"],
                  ["Risk Governor", "Active · CVaR-sized"],
                  ["Posture", "STABLE"],
                ],
              },
              {
                title: "FULL_OPTIMAL — Aggregate Universe",
                chip: "chip-green", chipLabel: "SUPERB · SQN 5+",
                rows: [
                  ["Validation", "Forward-test"],
                  ["Expectancy Floor", "≥ 0.4 R (95% CI)"],
                  ["Edge Quality", "Superb band"],
                  ["Risk Governor", "Active · CVaR-sized"],
                  ["Posture", "OOS ELITE"],
                ],
              },
              {
                title: "LIVE Execution — Current Deploy",
                chip: "chip-amber", chipLabel: "GOVERNED · Early stage",
                rows: [
                  ["Phase", "Capital-at-risk"],
                  ["Expectancy Floor", "Accumulating"],
                  ["Edge Quality", "Sample building"],
                  ["Risk Governor", "Gating active"],
                  ["Posture", "CAUTION · by design"],
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
              <strong style={{ color: "var(--amber)" }}>Note on deployment phase:</strong>{" "}
              The forward-tested universes span the full out-of-sample validation period and define
              the system&apos;s proven statistical envelope. Live deployment runs that same edge under
              active governor control — position sizing, capital unlocks, and operator commission are
              all gated on demonstrated execution quality. Early live phases are held at a CAUTION
              posture by design until sufficient capital-at-risk history accumulates; the governor
              never widens risk ahead of proven discipline.
            </p>
          </div>
        </div>
      </section>

      {/* ══ AGENCY PROBLEM ══════════════════════════════════════ */}
      <section style={{ paddingTop: 80, paddingBottom: 80, position: "relative", overflow: "hidden" }}>
        <SceneAccent
          variant="well"
          size={660}
          style={{ position: "absolute", top: -70, right: "clamp(-220px, -11vw, -70px)", opacity: 0.4, zIndex: 0 }}
        />
        <div className="site-container" style={{ position: "relative", zIndex: 1 }}>
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
