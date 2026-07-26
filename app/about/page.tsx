import type { Metadata } from "next";
import Link from "next/link";
import ProjectTimeline from "@/components/about/ProjectTimeline";
import LogoPortrait from "@/components/about/LogoPortrait";
import SafetyPlacard from "@/components/about/SafetyPlacard";
import IncidentLog from "@/components/about/IncidentLog";
import FoundingPrinciples from "@/components/about/FoundingPrinciples";
import ConstellationField from "@/components/about/ConstellationField";
import CountUp from "@/components/about/CountUp";
import StatCard from "@/components/about/StatCard";
import Reveal from "@/components/ui/Reveal";

export const metadata: Metadata = {
  title: "About — XTNL",
  description: "The founder, the origin story, and five years of building a systematic trading pipeline from first principles.",
};

/* ── Shared ─────────────────────────────────────────────── */
const sub = { color: "var(--ink-2)", lineHeight: 1.85, fontSize: 14 } as const;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mono section-eyebrow" style={{ marginBottom: 14 }}>{children}</p>
  );
}

function SectionLabel({ children, accent = "var(--green)" }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <span className="mono" style={{ fontSize: 9, fontWeight: 700, color: accent, letterSpacing: "0.16em" }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
    </div>
  );
}

function Divider() {
  return <div className="xtnl-divider-glow" style={{ width: "100%", height: 1, background: "var(--line)", margin: "72px 0" }} />;
}


/* ── Page ───────────────────────────────────────────────── */
export default function AboutPage() {
  return (
    <>
      <ConstellationField />

      {/* Hero — the mark, portrait style */}
      <section style={{ paddingTop: "calc(var(--nav-h) + 64px)", paddingBottom: 48, position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{
          position: "absolute", top: 0, left: "50%",
          transform: "translateX(-50%)",
          width: "min(1400px, 140vw)", height: "70vh",
          background: "radial-gradient(ellipse at 50% -10%, rgba(0,204,122,0.06) 0%, rgba(77,156,245,0.02) 40%, transparent 66%)",
          pointerEvents: "none",
        }} />

        <div className="site-container" style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <Eyebrow>XTNL Solutions · Founder&rsquo;s Log</Eyebrow>

          <LogoPortrait />

          <div style={{ maxWidth: 460, margin: "22px 0 30px" }}>
            <span className="mono" style={{ fontSize: 8.5, fontWeight: 700, color: "var(--ink-3)", letterSpacing: "0.16em" }}>
              THE MARK
            </span>
            <p style={{ fontSize: 12.5, lineHeight: 1.75, color: "var(--ink-3)", margin: "6px 0 0" }}>
              Two signature nodes cross into a single X — the moment two independent checks have to
              agree before a trade exists. Beneath it, a diamond vessel holds the capital at risk;
              the blue vertex marks the one figure the operator never sees.
            </p>
          </div>

          <h1 className="xtnl-shimmer-text" style={{
            fontSize: "clamp(28px, 5vw, 54px)",
            fontWeight: 800, letterSpacing: "-0.03em",
            lineHeight: 1.05,
            marginTop: 28, marginBottom: 20, maxWidth: 780,
          }}>
            Five years, one obsession: make discipline deterministic.
          </h1>
          <p style={{ ...sub, fontSize: 16, maxWidth: 620, marginBottom: 30 }}>
            XTNL began as one person&rsquo;s attempt to stop losing money to their own psychology.
            It is now a formally phase-gated quantitative pipeline — built, broken, and rebuilt
            from first principles, in public view of its own audit trail.
          </p>

          <SafetyPlacard />
        </div>
      </section>

      {/* Key figures */}
      <section style={{ paddingBottom: 88 }}>
        <div className="site-container" style={{ maxWidth: 980 }}>
          <Reveal>
            <SectionLabel>BY THE NUMBERS</SectionLabel>
            <h2 style={{ fontSize: "clamp(18px, 2.5vw, 24px)", fontWeight: 700, color: "var(--ink-0)", marginBottom: 14, lineHeight: 1.3 }}>
              The identity, and the gates it has to clear
            </h2>
            <p style={{ ...sub, maxWidth: 660, marginBottom: 30 }}>
              Every figure below is a real, currently-enforced constraint in the pipeline
              — not a target on a slide.
            </p>
          </Reveal>

          <Reveal delay={60}>
            <span className="mono" style={{ fontSize: 8.5, fontWeight: 700, color: "var(--ink-3)", letterSpacing: "0.14em" }}>
              IDENTITY
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, margin: "12px 0 30px" }}>
              <StatCard label="FOUNDED" value="Apr 2020" />
              <StatCard label="CURRENT PHASE" value="Phase 3" />
              <StatCard label="PIPELINE MODULES" value="SSoT" />
            </div>
          </Reveal>

          <Reveal delay={120}>
            <span className="mono" style={{ fontSize: 8.5, fontWeight: 700, color: "var(--ink-3)", letterSpacing: "0.14em" }}>
              DETERMINISM GATES
            </span>
            <p style={{ fontSize: 12.5, lineHeight: 1.7, color: "var(--ink-3)", margin: "6px 0 12px", maxWidth: 620 }}>
              An edge can&rsquo;t reach live capital below the minimum; it isn&rsquo;t considered mature
              until it clears the target — and the operator has to sustain their own threshold to
              keep trading it.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <StatCard label="MIN. DETERMINISM" value={<CountUp value={65} suffix="%" />} />
              <StatCard label="TARGET DETERMINISM" value={<CountUp value={90} suffix="%" />} />
              <StatCard label="OPERATOR THRESHOLD" value={<CountUp value={85} suffix="%" />} />
            </div>
          </Reveal>
        </div>
      </section>

      <Divider />

      {/* Origin story */}
      <section style={{ paddingBottom: 56 }}>
        <div className="site-container" style={{ maxWidth: 760 }}>
          <Reveal variant="scale">
            <SectionLabel>ORIGIN</SectionLabel>
            <h2 style={{ fontSize: "clamp(18px, 2.5vw, 24px)", fontWeight: 700, color: "var(--ink-0)", marginBottom: 22, lineHeight: 1.3 }}>
              A straight-A student, an English band 3, and a diversion that stuck
            </h2>
          </Reveal>

          <Reveal delay={60}>
            <p style={{ ...sub, marginBottom: 18 }}>
              Born 8 June 1999. A 94.65 ATAR out of Westall Secondary College in 2017 pointed toward
              radiography — until an EAL English band fell one mark short of the entry score.
              A bridging year aimed at biology and chemistry followed, and went badly: the redirect
              that actually stuck was into programming, which became a Bachelor of Science
              (Computing &amp; Software Systems) at the University of Melbourne — and prolonged
              graduation by more than a year in the process.
            </p>
          </Reveal>

          <Reveal delay={110}>
            <p style={{ ...sub, marginBottom: 18 }}>
              Investing came first and felt too slow. Six months later, trading did not. What
              followed was every mistake the textbooks warn about, compressed into real capital
              and real hours — including the one below.
            </p>
          </Reveal>

          <Reveal delay={160} style={{ marginBottom: 18 }}>
            <IncidentLog />
          </Reveal>

          <Reveal delay={210}>
            <p style={sub}>
              The first six months of study were read-and-apply, one session at a time, with no
              testing methodology to speak of — by later standards, a poor way to apply statistics.
              The year after was different: intensive manual backtesting, an Excel sheet, a scroll
              bar walked bar-by-bar until a real, repeatable expectancy of 0.8R emerged. The first
              system — Elliott wave and Fibonacci — ran live for four years in parallel with that
              backtesting. It produced weeks of real profit and years of realising <em>why</em> those
              weeks weren&rsquo;t repeatable: every setup was entered and managed differently, every
              time. Consistency, not another clever setup, was the actual problem to solve.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Founding principles */}
      <section style={{ paddingBottom: 88 }}>
        <div className="site-container" style={{ maxWidth: 980 }}>
          <Reveal variant="scale">
            <SectionLabel accent="var(--blue)">THE WISHLIST → THE PIPELINE</SectionLabel>
            <h2 style={{ fontSize: "clamp(18px, 2.5vw, 24px)", fontWeight: 700, color: "var(--ink-0)", marginBottom: 14, lineHeight: 1.3 }}>
              Five ideas from the live-trading years, now shipped
            </h2>
            <p style={{ ...sub, maxWidth: 660, marginBottom: 30 }}>
              None of this was achievable on a retail broker&rsquo;s website with a static 1% risk
              rule. These five requirements — written down during live execution, long before there
              was a codebase to hold them — became the founding design constraints of XTNL.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <FoundingPrinciples />
          </Reveal>
        </div>
      </section>

      <Divider />

      {/* Founder */}
      <section style={{ paddingBottom: 80 }}>
        <div className="site-container" style={{ maxWidth: 760 }}>
          <Reveal>
            <SectionLabel>FOUNDER</SectionLabel>
            <h2 style={{ fontSize: "clamp(16px, 2.5vw, 22px)", fontWeight: 700, color: "var(--ink-0)", marginBottom: 24, lineHeight: 1.3 }}>
              Background
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
              {[
                ["Born",      "8 June 1999 · Melbourne, VIC"],
                ["Secondary", "Westall Secondary College · ATAR 94.65 (2017)"],
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
              Sampling Methodology: no edge reaches live capital below 65% determinism, every
              material change resets to Phase 0, and nothing scales without a proven operator
              track record behind it.
            </p>
          </Reveal>
        </div>
      </section>

      <Divider />

      {/* Timeline */}
      <section style={{ paddingBottom: 100 }}>
        <div className="site-container">
          <Reveal>
            <SectionLabel>PROJECT TIMELINE</SectionLabel>
            <h2 style={{ fontSize: "clamp(16px, 2.5vw, 22px)", fontWeight: 700, color: "var(--ink-0)", marginBottom: 20, lineHeight: 1.3 }}>
              Development History
            </h2>
            <p style={{ ...sub, maxWidth: 620, marginBottom: 36 }}>
              Five years of the trading system and the thesis web platform that documents it — scroll to
              trace the progression, or filter to a single track.
            </p>
          </Reveal>

          <ProjectTimeline />
        </div>
      </section>

      <Divider />

      {/* CTA */}
      <section style={{ paddingBottom: 100 }}>
        <div className="site-container" style={{ maxWidth: 680 }}>
          <Reveal>
            <Eyebrow>Documentation</Eyebrow>
            <h2 style={{ fontSize: "clamp(16px, 2.5vw, 24px)", fontWeight: 700, color: "var(--ink-0)", marginBottom: 16, lineHeight: 1.3 }}>
              Further reading
            </h2>
            <p style={{ ...sub, marginBottom: 28 }}>
              The institutional prospectus covers the statistical framework, edge definitions,
              risk model, and system performance metrics in detail.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href="/prospectus" className="btn btn-primary xtnl-cta-glow" style={{ fontSize: 12, padding: "9px 22px" }}>
                Read Prospectus
              </Link>
              <Link href="/model" className="btn btn-ghost xtnl-cta-glow" style={{ fontSize: 12, padding: "9px 22px" }}>
                Run Simulation
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
