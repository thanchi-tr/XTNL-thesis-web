import type { Metadata } from "next";
import MetricCard from "@/components/ui/MetricCard";
import CodeBlock from "@/components/ui/CodeBlock";
import MathBlock from "@/components/ui/MathBlock";
import RDistributionChart from "@/components/RDistributionChart";
import HourlyHeatmap from "@/components/HourlyHeatmap";
import ProspectusSidebar from "@/components/prospectus/ProspectusSidebar";
import ProspectusMeta from "@/components/prospectus/ProspectusMeta";
import Link from "next/link";
import { auth } from "@/auth";

export const metadata: Metadata = { title: "Institutional Prospectus" };

/* ── Shared styles ─────────────────────────────────────── */
const prose = { color: "var(--ink-1)", lineHeight: 1.85, fontSize: 15 } as const;
const sub   = { color: "var(--ink-2)", lineHeight: 1.75, fontSize: 13.5 } as const;

/* ── Section header ────────────────────────────────────── */
function S({ id, n, title, q }: { id: string; n: string; title: string; q?: string }) {
  return (
    <div id={id} style={{ marginTop: 64, marginBottom: 20, scrollMarginTop: 84 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span
          className="mono"
          style={{ fontSize: 9, fontWeight: 700, color: "var(--green)", letterSpacing: "0.16em", textTransform: "uppercase" }}
        >
          §{n}
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
      </div>
      <h2 style={{ fontSize: "clamp(15px, 2vw, 20px)", fontWeight: 700, color: "var(--ink-0)", letterSpacing: "-0.01em", lineHeight: 1.3 }}>
        {title}
      </h2>
      {q && (
        <p className="mono" style={{ fontSize: 10, color: "rgba(0,204,122,0.7)", marginTop: 6, letterSpacing: "0.06em" }}>
          ↳ {q}
        </p>
      )}
    </div>
  );
}

/* ── Filter item ───────────────────────────────────────── */
function Fi({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ padding: "14px 16px 14px 20px", background: "var(--sub)", borderRadius: 4, borderLeft: "2px solid rgba(0,204,122,0.25)", position: "relative" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: "var(--green)", borderRadius: 1 }} />
      <p className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-0)", marginBottom: 5 }}>{title}</p>
      <p style={sub}>{body}</p>
    </div>
  );
}

/* ── Formula group ─────────────────────────────────────── */
function FormulaGroup({ items }: { items: { label: string; latex: string }[] }) {
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 6,
        overflow: "hidden",
        margin: "20px 0",
      }}
    >
      {items.map(({ label, latex }, i) => (
        <div
          key={i}
          style={{
            padding: "16px 20px",
            borderBottom: i < items.length - 1 ? "1px solid var(--line)" : "none",
            background: i % 2 === 0 ? "var(--sub)" : "var(--card)",
          }}
        >
          <p
            className="mono"
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "rgba(0,204,122,0.65)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            {String(i + 1).padStart(2, "0")} — {label}
          </p>
          <MathBlock latex={latex} bare />
        </div>
      ))}
    </div>
  );
}

/* ── Locked section gate ───────────────────────────────── */
function LockedSection({ title, teaser }: { title: string; teaser: string }) {
  return (
    <div style={{
      position: "relative",
      border: "1px solid var(--line)",
      borderLeft: "3px solid rgba(255,255,255,0.08)",
      borderRadius: "0 6px 6px 0",
      padding: "28px 28px 24px",
      background: "var(--card)",
      overflow: "hidden",
    }}>
      {/* Noise overlay */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.012) 3px, rgba(255,255,255,0.012) 4px)",
      }} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden style={{ flexShrink: 0, opacity: 0.45 }}>
          <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M4.5 6V4a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        <span className="mono" style={{ fontSize: 9.5, letterSpacing: "0.18em", color: "var(--ink-3)", textTransform: "uppercase" }}>
          RESTRICTED — {title}
        </span>
      </div>

      <p style={{ ...prose, color: "var(--ink-2)", marginBottom: 20, maxWidth: 580 }}>
        {teaser}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Link
          href="/api/auth/signin"
          className="btn btn-primary"
          style={{ fontSize: 11, padding: "9px 18px" }}
        >
          Sign in to view full detail →
        </Link>
        <span style={{ fontSize: 11, color: "var(--ink-3)", fontStyle: "italic" }}>
          Authorised investors only
        </span>
      </div>
    </div>
  );
}

/* ── Sidebar sections definition ──────────────────────── */
const SECTIONS = [
  { id: "s1",  n: "1",  title: "Thesis",              group: "Foundation" },
  { id: "s2",  n: "2",  title: "IP Decoupling",        group: "Foundation" },
  { id: "s3",  n: "3",  title: "Statistical Edge",     group: "Evidence"   },
  { id: "s4",  n: "4",  title: "Adversarial Filters",  group: "Evidence"   },
  { id: "s5",  n: "5",  title: "WFO & 19:00 Vaccine",  group: "Evidence"   },
  { id: "s6",  n: "6",  title: "Regime Detection",     group: "Evidence"   },
  { id: "s7",  n: "7",  title: "Risk Allocation",      group: "Evidence"   },
  { id: "s8",  n: "8",  title: "Operator Architecture",group: "Operations" },
  { id: "s9",  n: "9",  title: "Capital Scaling",      group: "Operations" },
  { id: "s10", n: "10", title: "Simulation",           group: "Operations" },
  { id: "s11", n: "11", title: "Taxation",             group: "Operations" },
  { id: "s12", n: "12", title: "Agency Problem",       group: "Governance" },
  { id: "s13", n: "13", title: "LLM Auditor",          group: "Governance" },
  { id: "s14", n: "14", title: "Test Coverage",        group: "Governance" },
];

/* ── Code snippets ─────────────────────────────────────── */
const CODE_TRANSFORM = `<span style="color:rgba(142,163,190,0.6);font-style:italic"># Adversarial filter stack applied before any metric computation</span>
data = apply(HypotheticalMarginalAdjustmentFilter, data, interval=haircut_dto)
data = apply(OperatorExpectedPerformanceFilter,     data, interval=operator_cut_dto)
data = apply(ToxicStreakFilter,                     data, interval=operator_cut_dto)

<span style="color:rgba(142,163,190,0.6);font-style:italic"># Temporal quarantine — excise identified blackout windows</span>
subset = apply(SessionFilter, data, interval=session_dto)
<span style="color:#f87171">for</span> period <span style="color:#f87171">in</span> excl_windows:
    subset = apply(ExcludeFilter, subset, interval=period)

<span style="color:rgba(142,163,190,0.6);font-style:italic"># Outlier removal — sever dependency on fat-tail windfalls</span>
subset = apply(ResultFilter, subset, interval=r_filter_dto)`;

const CODE_HMM = `<span style="color:rgba(142,163,190,0.6);font-style:italic"># Scale-invariant momentum (5-period EWM Z-score)</span>
roll_mean = df[col].ewm(span=5, min_periods=1).mean()
roll_std  = np.sqrt(df[col].ewm(span=5).var()).replace(0, 1e-6)
feats['expectancy_z'] = (df[col] - roll_mean) / roll_std

<span style="color:rgba(142,163,190,0.6);font-style:italic"># Execution density — detects revenge-trading acceleration</span>
t_delta = pd.to_datetime(df[time_col]).diff().dt.total_seconds() / 3600.0
feats['log_density'] = np.log1p(t_delta.clip(lower=0).fillna(0))

<span style="color:rgba(142,163,190,0.6);font-style:italic"># Diurnal fatigue (circular encoding — no midnight discontinuity)</span>
h = pd.to_datetime(df[time_col]).dt.hour
feats['sin_hour'] = np.sin(2 * np.pi * h / 24.0)
feats['cos_hour'] = np.cos(2 * np.pi * h / 24.0)`;

const CODE_CBB = `<span style="color:#c792ea">def</span> <span style="color:#82b1ff">circular_block_bootstrap</span>(
    data: np.ndarray, block_size: <span style="color:#c792ea">int</span>, sample_size: <span style="color:#c792ea">int</span>
) -> np.ndarray:
    <span style="color:rgba(142,163,190,0.6);font-style:italic"># Wrap so blocks straddle boundary — eliminates edge bias</span>
    circular = np.concatenate([data, data[:block_size]])
    n_blocks = <span style="color:#c792ea">int</span>(np.ceil(sample_size / block_size))
    starts   = np.random.randint(0, <span style="color:#c792ea">len</span>(data), size=n_blocks)
    blocks   = [circular[i : i + block_size] <span style="color:#f87171">for</span> i <span style="color:#f87171">in</span> starts]
    <span style="color:#f87171">return</span> np.concatenate(blocks)[:sample_size]`;

export default async function ProspectusPage() {
  const session = await auth();
  const authed  = Boolean(session?.twoFactorVerified);

  return (
    <div className="site-container" style={{ paddingTop: 40, paddingBottom: 96 }}>

      {/* ── Breadcrumb ──────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 36, flexWrap: "wrap" }}>
        <Link href="/" style={{ fontSize: 12, color: "var(--ink-2)", textDecoration: "none" }}>Overview</Link>
        <span style={{ color: "var(--ink-3)", fontSize: 12 }}>/</span>
        <span className="mono" style={{ fontSize: 12, color: "var(--ink-1)" }}>Institutional Prospectus</span>
      </div>

      {/* ── Cover ───────────────────────────────────────────── */}
      <div style={{ marginBottom: 40 }}>
        <p className="section-eyebrow" style={{ marginBottom: 14 }}>XTNL Solutions</p>
        <h1
          style={{
            fontSize: "clamp(26px, 4vw, 48px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--ink-0)",
            lineHeight: 1.1,
            marginBottom: 16,
            maxWidth: 680,
          }}
        >
          Institutional Prospectus
        </h1>
        <p style={{ ...prose, maxWidth: 560, color: "var(--ink-2)", marginBottom: 28 }}>
          A technical exposition of the XTNL quantitative framework — statistical validation,
          system architecture, risk management, capital projection, and governance design.
        </p>

        {/* Identity / system fact grid — generalised, scroll-reactive */}
        <ProspectusMeta />
      </div>

      {/* ── Two-column layout ───────────────────────────────── */}
      {/* ProspectusSidebar manages its own visibility via matchMedia */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 48 }}>
        <ProspectusSidebar sections={SECTIONS} />

        {/* Content ─────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* TL;DR */}
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderLeft: "3px solid var(--green)",
              borderRadius: "0 6px 6px 0",
              padding: "24px 24px",
              marginBottom: 4,
            }}
          >
            <span className="chip chip-green" style={{ marginBottom: 14 }}>Thesis Summary</span>
            <p style={{ ...prose, marginBottom: 12 }}>
              XTNL is a systematic compounding framework whose primary objective is building durable
              financial legacy through arbitrage of statistically verified market inefficiencies.
              The framework is not built around a single trade thesis — it is built around a
              reusable architecture that can load, validate, and deploy any edge that passes
              its empirical gatekeeping criteria.
            </p>
            <p style={prose}>
              Primary core (SESSION_FILTERED, N=106): SQN{" "}
              <strong style={{ color: "var(--green)" }}>4.253</strong> · Expectancy{" "}
              <strong style={{ color: "var(--green)" }}>0.982 R</strong> · WFO OOS{" "}
              <strong style={{ color: "var(--green)" }}>0.904 R</strong> · Status:{" "}
              <strong style={{ color: "var(--green)" }}>STABLE</strong>.
              Live execution (N=29) carries [CAUTION] status — expected at this sample size.
            </p>
          </div>

          {/* ══ §1 — Thesis ══════════════════════════════════ */}
          <S id="s1" n="1" title="The Primary Thesis — Legacy Through Arbitrage" />
          <p style={{ ...prose, marginBottom: 12 }}>
            The XTNL entity was established on a specific hypothesis: that persistent, quantifiable
            inefficiencies exist within the EUR/USD spot market, and that an operator equipped with
            a sufficiently disciplined, systematic execution framework can capture those inefficiencies
            consistently enough to compound capital into a multi-generational asset base.
          </p>
          <p style={prose}>
            This is a research and execution business. Its value does not depend on any single
            trade or any particular market condition. It depends on the integrity of a process:
            an evidence-gathering pipeline, a statistical validation regime, a risk architecture
            derived from empirical tail-risk data, and an execution system that removes human
            discretion from real-time capital allocation decisions.
          </p>

          {/* ══ §2 — IP Decoupling (WAS §7) ══════════════════ */}
          <S id="s2" n="2" title="Infrastructure vs. IP — The Core Architecture" q="Q5 — How does architecture avoid coupling to the edge?" />
          <p style={{ ...prose, marginBottom: 16 }}>
            Any specific market edge will eventually decay. Structural regime changes, increased
            market participants, and algorithmic adaptation erode the statistical advantage of any
            fixed strategy over time. The XTNL architecture resolves this through strict structural
            decoupling between two distinct layers.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10, marginBottom: 20 }}>
            <div className="card" style={{ padding: 22, borderLeft: "3px solid var(--blue)" }}>
              <span className="chip chip-blue" style={{ marginBottom: 12 }}>Tangible Asset Chassis</span>
              <p style={sub}>
                The permanently owned layer: analytics pipeline, CVaR risk engine, HMM oracle,
                WFO validation system, execution firmware, and capital allocation logic.
                Continuously refined. Not strategy-specific. Can load any edge that satisfies
                the validation criteria.
              </p>
            </div>
            <div className="card" style={{ padding: 22, borderLeft: "3px solid var(--amber)" }}>
              <span className="chip chip-amber" style={{ marginBottom: 12 }}>IP Payload</span>
              <p style={sub}>
                The specific edge definition: conditions under which the system identifies an
                execution opportunity. Treated as a replaceable, ephemeral payload.
                When WFO signals critical decay, the payload is retired and the chassis
                remains intact for the next validated edge.
              </p>
            </div>
          </div>

          <p style={{ ...prose, marginBottom: 18 }}>
            Any newly proposed edge must pass a 5-stage deployment lifecycle before receiving
            access to full capital. The pipeline retains absolute authority to halt at any stage
            if OOS performance degrades below acceptable thresholds.
          </p>

          <div style={{ background: "var(--sub)", border: "1px solid var(--line)", borderRadius: 6, padding: "18px 22px" }}>
            <ol style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                ["TESTING",    "Isolated backtest matrix validation against the adversarial filter stack."],
                ["SEEDLING 1", "Micro-lot live execution — verifying firmware latency and fill integrity."],
                ["SEEDLING 2", "Sub-scale operational exposure — testing human-firmware friction at low capital."],
                ["SCALING",    "Gradual risk multiplier unlocking, gated by trailing SQN thresholds."],
                ["FULL DEPLOY","Full capital access, subject to continuous WFO and regime monitoring."],
              ].map(([stage, body], i) => (
                <li key={stage} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <span className="mono" style={{ fontSize: 10, color: "var(--green)", fontWeight: 700, minWidth: 22, paddingTop: 2 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <span className="mono" style={{ fontSize: 11, color: "var(--ink-0)", fontWeight: 700, marginRight: 10 }}>{stage}</span>
                    <span style={{ fontSize: 13, color: "var(--ink-2)" }}>{body}</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* ══ §3 — Edge ════════════════════════════════════ */}
          <S id="s3" n="3" title="Statistical Validation of the Edge" q="Q3 — What are the odds this edge is real?" />
          <p style={{ ...prose, marginBottom: 20 }}>
            The null hypothesis states that observed returns are indistinguishable from random noise.
            Rejecting this requires demonstrating that the expectancy distribution is significantly
            above zero across a non-overlapping, independently sampled dataset.
          </p>

          <FormulaGroup items={[
            { label: "Null Hypothesis",   latex: "H_0: \\mu_R \\le 0 \\quad \\text{(Returns are random noise)}" },
            { label: "Alternative",       latex: "H_1: \\mu_R > 0 \\quad \\text{(Verifiable market inefficiency)}" },
            { label: "System Quality",    latex: "\\text{SQN} = \\frac{\\mu_R}{\\sigma_R} \\cdot \\sqrt{N} \\;,\\quad t = \\frac{\\mu_R}{\\text{SEM}} = \\frac{0.982}{0.231} = 4.251" },
          ]} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 8, margin: "20px 0" }}>
            <MetricCard label="Expectancy (μ)"  value="0.982 R" color="green" />
            <MetricCard label="SQN"             value="4.253"   color="green" />
            <MetricCard label="95% CI Lower"    value="0.529 R" color="green" sub="Pessimistic floor" />
            <MetricCard label="Profit Factor"   value="3.109×"  color="green" />
            <MetricCard label="t-Statistic"     value="4.251"   color="blue"  />
            <MetricCard label="OOS Expectancy"  value="0.904 R" color="green" sub="Walk-forward" />
          </div>

          <RDistributionChart />

          {/* ══ §4 — Filters ═════════════════════════════════ */}
          <S id="s4" n="4" title="The Adversarial Filter Stack" q="Q2 — What is baseline after friction and taxation?" />
          <p style={{ ...prose, marginBottom: 20 }}>
            The raw theoretical dataset is never used for any reported metric. The pipeline
            applies a sequential adversarial filter stack that deliberately degrades the
            theoretical optimal dataset to model worst-case operational conditions.
            The 0.982 R expectancy is computed <em>downstream</em> of this entire matrix.
          </p>

          <CodeBlock filename="src/pipeline/xtnl_pipeline.py — _transform()">{CODE_TRANSFORM}</CodeBlock>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            <Fi title="HypotheticalMarginalAdjustmentFilter" body="Compresses every theoretical winner and expands every theoretical loser, modelling broker spread widening and order-book latency." />
            <Fi title="OperatorExpectedPerformanceFilter" body="Hard cap: operator is modelled at maximum 85% of theoretical optimal. 15% of net theoretical yield is unconditionally removed." />
            <Fi title="ToxicStreakFilter" body="Models compound effect of consecutive losses on execution quality. Each loss in a streak applies an incremental penalty to subsequent returns." />
            <Fi title="SessionFilter + ExcludeFilter" body="Restricts the sample to validated execution windows. Identified toxic temporal clusters are excised. The 19:00 AEST window was discovered via WFO and permanently quarantined." />
            <Fi title="ResultFilter — Outlier Removal" body="Removes the top 5th percentile of positive outcomes. The system must demonstrate positive expectancy without relying on extreme tail windfalls." />
          </div>

          {/* ══ §5 — WFO ═════════════════════════════════════ */}
          <S id="s5" n="5" title="Walk-Forward Optimisation — Curve-Fitting Detection" q="Q4 — How do we prove the edge is not curve-fitted?" />
          <p style={{ ...prose, marginBottom: 16 }}>
            WFO tests the system on data it has never seen. If the edge is structural, OOS
            performance remains consistent. If it is curve-fitted, OOS performance collapses.
            Fold 3 (77.5% degradation) was traced to the 19:00 AEST temporal cluster, which
            was subsequently quarantined.
          </p>

          <div style={{ overflowX: "auto", marginBottom: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {["Stage","Train N","Test N","IS SQN","OOS SQN","OOS E","Degradation"].map((h) => (
                    <th key={h} className="mono" style={{ padding: "9px 12px", textAlign: "left", fontSize: 9, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--ink-2)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Fold 1","22","21","2.248","1.853","0.889 R","17.56%","var(--blue)"],
                  ["Fold 2","43","21","2.938","3.059","1.583 R","−4.11%","var(--green)"],
                  ["Fold 3","64","21","4.163","0.937","0.457 R","77.50%","var(--red)"],
                  ["Fold 4","85","21","4.094","1.300","0.686 R","68.26%","var(--amber)"],
                  ["Aggregate","—","—","—","1.787","0.904 R","STABLE","var(--green)"],
                ].map(([s,tr,te,is_,oos,oose,deg,dc]) => (
                  <tr key={s}>
                    {[s,tr,te].map((v,j) => <td key={j} className="mono" style={{ padding:"10px 12px",borderBottom:"1px solid var(--line)",color:s==="Aggregate"?"var(--ink-0)":"var(--ink-2)",fontWeight:s==="Aggregate"?700:400 }}>{v}</td>)}
                    <td className="mono" style={{ padding:"10px 12px",borderBottom:"1px solid var(--line)",color:"var(--blue)" }}>{is_}</td>
                    <td className="mono" style={{ padding:"10px 12px",borderBottom:"1px solid var(--line)",color:Number(oos)<1?"var(--amber)":"var(--green)" }}>{oos}</td>
                    <td className="mono" style={{ padding:"10px 12px",borderBottom:"1px solid var(--line)",color:"var(--green)" }}>{oose}</td>
                    <td className="mono" style={{ padding:"10px 12px",borderBottom:"1px solid var(--line)",color:dc as string,fontWeight:s==="Aggregate"?700:400 }}>{deg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <HourlyHeatmap />

          {/* ══ §6 — HMM ════════════════════════════════════ */}
          <S id="s6" n="6" title="Market Regime Detection Engine" />
          {authed ? (
            <>
              <p style={{ ...prose, marginBottom: 18 }}>
                The system does not assume a stationary market. A Gaussian Hidden Markov Model (HMM)
                continuously infers market regime from three observable features via Viterbi decoding.
                A 95% self-loop sticky prior prevents noise-driven micro-regime-flipping.
                Both regimes show positive expectancy — the oracle calibrates risk, it does not halt trading.
              </p>

              <CodeBlock filename="src/action/market_context/abstract_infer_regime.py">{CODE_HMM}</CodeBlock>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 16 }}>
                {[
                  { regime: "ALPHA_FLOW",    sqn: "3.210", n: "93",  e: "0.820 R", chip: "chip-green" },
                  { regime: "TOXIC_FATIGUE", sqn: "4.105", n: "215", e: "0.638 R", chip: "chip-amber" },
                ].map(({ regime, sqn, n, e, chip }) => (
                  <div key={regime} className="card" style={{ padding: "16px 18px" }}>
                    <span className={`chip ${chip}`} style={{ marginBottom: 12 }}>{regime}</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                      {[["N", n], ["SQN", sqn], ["Expectancy", e]].map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: "var(--ink-2)" }}>{k}</span>
                          <span className="mono" style={{ fontSize: 12, color: "var(--ink-0)", fontWeight: 600 }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <LockedSection
              title="Market Regime Detection Engine"
              teaser="The framework incorporates a continuous market regime classifier that updates in real time as new execution data arrives. Rather than assuming the market behaves uniformly, the system continuously recalibrates risk posture to the inferred regime — without halting deployment. Both detected regimes carry statistically verifiable positive expectancy. Feature engineering methodology, model architecture, and per-regime performance breakdown are restricted to authenticated investors."
            />
          )}

          {/* ══ §7 — CVaR ═══════════════════════════════════ */}
          <S id="s7" n="7" title="Dynamic Risk Allocation Engine" />
          {authed ? (
            <>
              <p style={{ ...prose, marginBottom: 18 }}>
                Position sizing is derived entirely from the tail-risk distribution of the edge&apos;s
                own historical outcomes. The{" "}
                <code style={{ color: "var(--green)", fontFamily: "var(--font-mono), monospace", fontSize: 13 }}>
                  BlockBootstrapMCRiskEngine
                </code>{" "}
                runs 5,000 simulations using Circular Block Bootstrapping — preserving the
                autocorrelation structure of losing streaks (critical for modelling tilt sequences).
              </p>

              <CodeBlock filename="src/analytics/risk/risk_engine.py — circular_block_bootstrap()">{CODE_CBB}</CodeBlock>

              <FormulaGroup items={[
                { label: "CVaR (Expected Shortfall)",  latex: "\\text{CVaR}_{95} = \\mathbb{E}\\!\\left[\\,DD \\;\\middle|\\; DD \\le \\text{VaR}_{95}\\,\\right]" },
                { label: "Position Size Derivation",   latex: "\\theta_{base} = \\frac{\\text{Target DD Limit}}{|\\text{CVaR}_{95}|} = \\frac{10\\%}{13.711\\,\\text{R}} \\approx 0.70\\%" },
              ]} />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 8, marginTop: 4 }}>
                <MetricCard label="MC 95% CVaR"      value="−13.711 R" color="red"   />
                <MetricCard label="Recommend R (θ)"  value="0.70%"     color="blue"  sub="System-derived" />
                <MetricCard label="Max DD Duration"   value="12 trades" color="blue"  sub="Primary core" />
              </div>
            </>
          ) : (
            <LockedSection
              title="Dynamic Risk Allocation Engine"
              teaser="Position sizing is not set by fixed heuristics or operator discretion — it is derived analytically from the empirical tail-risk distribution of the edge's own historical outcomes. The engine accounts for autocorrelated losing sequences, a structural property that naïve sizing models systematically underweight. Full methodology, bootstrapping architecture, derived sizing parameters, and drawdown statistics are restricted to authenticated investors."
            />
          )}

          {/* ══ §8 — Operator ════════════════════════════════ */}
          <S id="s8" n="8" title="Operator Architecture — Removing Human Agency" />
          <p style={{ ...prose, marginBottom: 16 }}>
            The most significant source of performance leakage in any systematic strategy is
            discretionary human interference. XTNL addresses this through multi-layered
            behavioural isolation.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { badge: "Monetary Abstraction",    body: "Operator has zero visibility into fiat values during live sessions. The firmware scrambles all monetary figures into abstract unit coordinates, eliminating dollar-amount-driven decision-making." },
              { badge: "Performance-Gated Sizing", body: "Efficiency is scored weekly. Below 80%, sizes are cut to 60%. Below 40%, the system halts. These are firmware constraints — not policies the operator can override." },
              { badge: "Deterministic Execution",  body: "96.5% of all capital decisions are made algorithmically. The operator's only real-time function is identifying execution coordinates; the firmware handles everything else." },
            ].map(({ badge, body }) => (
              <div key={badge} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 16px", background: "var(--sub)", border: "1px solid var(--line)", borderRadius: 5 }}>
                <span className="chip chip-muted" style={{ marginTop: 2, flexShrink: 0 }}>{badge}</span>
                <p style={sub}>{body}</p>
              </div>
            ))}
          </div>

          {/* ══ §9 — Capital Scaling ═════════════════════════ */}
          <S id="s9" n="9" title="Capital Scaling Model — Friction-Adjusted Projections" q="Q1 — Am I making money at 85% efficiency?" />
          <p style={{ ...prose, marginBottom: 20 }}>
            The question of whether the system generates positive expected value at 85% execution
            efficiency requires modelling five adversarial friction vectors simultaneously.
            Clean linear arithmetic does not survive contact with live markets.
          </p>

          <FormulaGroup items={[
            { label: "Weekly Expected Return (85% cap)",  latex: "E_{week} = \\mu_R \\times T_{week} \\times 0.85" },
            { label: "Stochastic Weekly Yield",           latex: "Y_{raw} = \\Bigl(E_{week}\\cdot(1-\\delta)^{\\lfloor n/13\\rfloor}\\Bigr) + \\sigma_{week}\\cdot Z,\\quad Z\\sim\\mathcal{N}(0,1)" },
            { label: "Equity Compounding + Injection",    latex: "C_k = (C_{k-1}+I_{yr})\\cdot\\left(1+\\theta_{applied}\\cdot Y_{post\\text{-}friction}\\right)" },
            { label: "Post-Tax Equity",                   latex: "C_{post\\text{-}tax} = C_k - \\max\\!\\left(0,\\;(C_k - C_{y\\text{-}start})\\times\\tau_{ATO}\\right)" },
          ]} />

          <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: -4, marginBottom: 8, textAlign: "center", lineHeight: 1.7 }}>
            δ = quarterly edge decay rate · τ_ATO = 47% (ATO maximum statutory rate) · θ = 0.70% (CVaR-derived)
          </p>

          {/* ══ §10 — Simulation ═════════════════════════════ */}
          <S id="s10" n="10" title="1,000-Iteration Monte Carlo Simulation" />
          <p style={{ ...prose, marginBottom: 20 }}>
            Only by iterating the stochastic process across 1,000 independent realisations does
            the probability distribution of outcomes become visible. The Law of Large Numbers
            forces chaotic weekly variance to cluster around the true mathematical expectancy.
            The engine models operator efficiency as an Ornstein-Uhlenbeck mean-reverting process —
            replacing the crude fixed 85% cap with a realistic, autocorrelated efficiency trajectory
            that fluctuates between 60%–100% and dynamically gates position sizes.
          </p>
          <div
            className="card"
            style={{
              padding: 28,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 24,
              borderLeft: "3px solid var(--green)",
            }}
          >
            <div>
              <p className="section-eyebrow" style={{ marginBottom: 10 }}>Interactive Simulator</p>
              <p style={{ fontSize: 14, color: "var(--ink-1)", lineHeight: 1.7, maxWidth: 420 }}>
                The full simulation engine is available on the dedicated model page. Adjust every
                parameter — operator mean efficiency, edge decay, capital injection window,
                drawdown halt — and observe the probability distribution shift in real time.
              </p>
            </div>
            <Link href="/model" className="btn btn-primary" style={{ flexShrink: 0, padding: "12px 24px", fontSize: 12 }}>
              Open Simulator →
            </Link>
          </div>

          {/* ══ §11 — Taxation ═══════════════════════════════ */}
          <S id="s11" n="11" title="ATO Taxation Modelling" />
          <p style={{ ...prose, marginBottom: 16 }}>
            Under ATO regulations, profits from algorithmic foreign exchange trading are classified
            as ordinary assessable income. A realisation event occurs at contract close. The XTNL
            Trust applies a flat <strong style={{ color: "var(--red)" }}>47%</strong> statutory
            drag — the maximum marginal rate inclusive of the 2% Medicare Levy — as the pessimistic
            tax assumption in all capital projections.
          </p>

          <div style={{ borderRadius: 6, overflow: "hidden", border: "1px solid var(--line)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--sub)" }}>
                  {["2026–27 Taxable Income","Marginal Rate","Effective (incl. 2% Medicare)"].map((h) => (
                    <th key={h} className="mono" style={{ padding: "11px 14px", textAlign: "left", fontSize: 9, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--ink-2)", borderBottom: "1px solid var(--line)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[["$0–$18,200","0%","0%"],["$18,201–$45,000","15%","17%"],["$45,001–$135,000","30%","32%"],["$135,001–$190,000","37%","39%"],["$190,001+","45%","47% ◄ MODELLED"]].map(([inc,rate,eff],i,arr) => (
                  <tr key={inc}>
                    {[inc,rate,eff].map((v,j) => (
                      <td key={j} className="mono" style={{ padding:"10px 14px",borderBottom:i<arr.length-1?"1px solid var(--line)":"none",color:i===arr.length-1?j===2?"var(--red)":"var(--ink-0)":"var(--ink-2)" }}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ══ §12 — Agency Problem ═════════════════════════ */}
          <S id="s12" n="12" title="Incentive Architecture — Resolving the Agency Problem" />
          <p style={{ ...prose, marginBottom: 16 }}>
            The classical principal-agent problem: the person managing capital has interests that
            can diverge from those of the capital owner. XTNL treats this as an engineering
            problem. Every misalignment vector is addressed with a deterministic, code-enforced
            mechanism — not a governance policy.
          </p>

          {/* Commission formula */}
          <div style={{ background: "var(--sub)", border: "1px solid var(--line)", borderRadius: 6, padding: "20px", marginBottom: 20 }}>
            <p className="label-xs" style={{ marginBottom: 12 }}>Commission Formula</p>
            <p className="mono" style={{ fontSize: 13, color: "var(--green)", marginBottom: 16 }}>
              commission = (week_R × 0.20 + max(realised_R × 0.05, 0)) × multiplier
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8 }}>
              {[
                ["Fixed Base Rate",        "20% of recommended R"],
                ["Profit Bonus",           "5% of realised R (profitable weeks only)"],
                ["Excellence Multiplier",  "1.5× when efficiency > 95%"],
                ["Commission Floor",       "$0 if efficiency < 88% OR capture rate < 75%"],
              ].map(([k, v]) => (
                <div key={k} style={{ padding: "10px 12px", background: "var(--card)", borderRadius: 4, border: "1px solid var(--line)" }}>
                  <p className="label-xs" style={{ marginBottom: 5 }}>{k}</p>
                  <p className="mono" style={{ fontSize: 11, color: "var(--green)" }}>{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Agency matrix */}
          <div style={{ overflowX: "auto", marginBottom: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {["Agency Risk","System Resolution","Layer"].map((h) => (
                    <th key={h} className="mono" style={{ padding:"9px 12px",textAlign:"left",fontSize:9,letterSpacing:"0.10em",textTransform:"uppercase",color:"var(--ink-2)",borderBottom:"1px solid var(--line)",whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Excessive risk-taking",           "Efficiency multiplier 0.0–1.18× caps sizing to demonstrated capability",  "Firmware"],
                  ["Claiming lucky trades as edge",    "Lucky trades isolated; excluded from efficiency calculation",              "Analytics"],
                  ["Hiding performance deterioration", "Z-score tracking reveals statistical drift from system baseline",         "Weekly audit"],
                  ["Reward without accountability",    "Commission = $0 unless efficiency ≥ 88% AND capture rate ≥ 75%",          "Action generator"],
                  ["Capital on deteriorating perf.",   "Locked capital: 3+ consecutive weeks ≥ 88% required to unlock",          "Memory governor"],
                  ["Revenge trading after losses",     "MC95 sentinel: graduated haircuts 0.6× → 0.5× on streak ratio",           "R generator"],
                ].map(([risk,res,layer],i,arr) => (
                  <tr key={risk}>
                    <td style={{ padding:"11px 12px",borderBottom:i<arr.length-1?"1px solid var(--line)":"none",color:"var(--ink-1)",fontSize:12,verticalAlign:"top" }}>{risk}</td>
                    <td style={{ padding:"11px 12px",borderBottom:i<arr.length-1?"1px solid var(--line)":"none",color:"var(--ink-2)",fontSize:12,verticalAlign:"top" }}>{res}</td>
                    <td style={{ padding:"11px 12px",borderBottom:i<arr.length-1?"1px solid var(--line)":"none",verticalAlign:"top" }}>
                      <span className="chip chip-muted">{layer}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Capital lock timeline */}
          <div
            style={{ position: "relative", paddingLeft: 28, marginBottom: 20 }}
          >
            <div style={{ position: "absolute", left: 7, top: 10, bottom: 10, width: 1, background: "var(--line)" }} />
            {[
              { label: "Week 1", cond: "Efficiency ≥ 88%", res: "Streak = 1", c: "var(--blue)" },
              { label: "Week 2", cond: "Efficiency ≥ 88%", res: "Streak = 2", c: "var(--blue)" },
              { label: "Week 3", cond: "Efficiency ≥ 88%", res: "Streak = 3 → Capital unlocks", c: "var(--green)" },
              { label: "Week 4", cond: "Efficiency < 88%", res: "Streak = 0 → Capital relocks",  c: "var(--red)" },
            ].map(({ label, cond, res, c }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0" }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: c, border: "2px solid var(--base)", position: "absolute", left: 2 }} />
                <span className="mono" style={{ fontSize: 10, color: "var(--ink-2)", minWidth: 52 }}>{label}</span>
                <span style={{ fontSize: 12, color: "var(--ink-1)" }}>{cond}</span>
                <span className="mono" style={{ fontSize: 10, color: c, fontWeight: 700 }}>→ {res}</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 20, borderLeft: "3px solid var(--green)" }}>
            <p style={{ ...sub, color: "var(--ink-1)" }}>
              <strong style={{ color: "var(--ink-0)" }}>The design intent:</strong>{" "}
              The operator&apos;s financial incentives are structured such that disciplined, high-quality
              execution is the path of maximum personal financial return. Reckless or inconsistent
              behaviour carries automatic, immediate, and disproportionate penalties.
              The system is not managed — it manages itself. The operator is not trusted — they are measured.
            </p>
          </div>

          {/* ══ §13 — LLM Auditor ════════════════════════════ */}
          <S id="s13" n="13" title="The Third Perspective — LLM Sovereign Risk Auditor" />
          <p style={{ ...prose, marginBottom: 16 }}>
            Quantitative models are structurally blind to the narrative layer. A statistical system
            can detect that the operator&apos;s efficiency dropped to 72% — but it cannot determine
            whether the operator is rationalising underperformance, masking hesitation as strategic
            patience, or exhibiting recidivism in a flaw they appeared to have conquered three weeks prior.
          </p>
          <p style={{ ...prose, marginBottom: 20 }}>
            The <code style={{ color: "var(--green)", fontFamily: "var(--font-mono), monospace", fontSize: 13 }}>XTNLS_RiskEngine</code> introduces
            a third governance perspective — a large language model acting as Chief Risk Officer.
            It receives both quantitative performance telemetry and the operator&apos;s freeform
            commentary, then produces a structured psychological dossier.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--line)", borderRadius: 6, overflow: "hidden", marginBottom: 20 }}>
            {[
              ["1", "Statistical Pipeline",    "Produces quantitative performance dict — efficiency, capture rate, Z-scores.",         "var(--blue)"],
              ["2", "Deterministic Pass",       "Hard rules in priority order: early_exit → rule_skip → external_crisis → efficiency < 85%.", "var(--amber)"],
              ["3", "LLM Forensic Analysis",   "Receives operator comments, quantitative context, historical dossier, and active 'demon' list.", "var(--green)"],
              ["4", "Flaw Lifecycle Manager",  "8 flaw categories tracked week-to-week. Relapses flagged. Flaws persist 6 weeks to graduate.", "var(--green)"],
              ["5", "Atomic State Write",       "Immutable timestamped audit log. Demons, dossier, and system state persisted atomically.",  "var(--ink-2)"],
              ["6", "CRO Risk Override",        "LLM output feeds back into risk allocation. Mandatory deload at streak ≥ 6 or fatigue flag.", "var(--red)"],
            ].map(([n, label, desc, color]) => (
              <div key={n} style={{ display: "flex", gap: 14, padding: "12px 16px", background: "var(--card)", alignItems: "flex-start" }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: `${color}18`, border: `1px solid ${color}35`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: color as string, flexShrink: 0, marginTop: 1 }}>{n}</span>
                <div>
                  <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-0)", marginRight: 10 }}>{label}</span>
                  <span style={{ fontSize: 12, color: "var(--ink-2)" }}>{desc}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 6, marginBottom: 20 }}>
            {["Rule_Violation","Hesitation","Premature_Exit","Fatigue_Execution","Over_sizing","Revenge_Tilt","Focus_Distraction","FOMO_Chasing"].map((flaw) => (
              <div key={flaw} className="card" style={{ padding: "10px 12px" }}>
                <p className="mono" style={{ fontSize: 10, fontWeight: 700, color: "var(--amber)" }}>{flaw}</p>
              </div>
            ))}
          </div>

          <div style={{ overflowX: "auto", marginBottom: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {["Verdict","Trigger","Streak","Commission"].map((h) => (
                    <th key={h} className="mono" style={{ padding:"9px 12px",textAlign:"left",fontSize:9,letterSpacing:"0.10em",textTransform:"uppercase",color:"var(--ink-2)",borderBottom:"1px solid var(--line)",whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["PASS","All gates clear, eff ≥ 85%","Streak +1","Normal","chip-green"],
                  ["PASS (GRACE)","External crisis verified","Held","Normal","chip-blue"],
                  ["FAIL (EXECUTION)","Efficiency < 85%","Reset","Forfeited","chip-amber"],
                  ["FAIL (ROLE BLEED)","Trading rules violated","Reset","Forfeited","chip-red"],
                  ["ALPHA_MURDER","Session terminated early","Reset","Maximum penalty","chip-red"],
                ].map(([status,trigger,streak,comm,chip],i,arr) => (
                  <tr key={status as string}>
                    <td style={{ padding:"10px 12px",borderBottom:i<arr.length-1?"1px solid var(--line)":"none" }}>
                      <span className={`chip ${chip}`}>{status}</span>
                    </td>
                    {[trigger,streak,comm].map((v,j) => (
                      <td key={j} style={{ padding:"10px 12px",borderBottom:i<arr.length-1?"1px solid var(--line)":"none",color:"var(--ink-2)",fontSize:12,verticalAlign:"top" }}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ══ §14 — Test Coverage ══════════════════════════ */}
          <S id="s14" n="14" title="Architecture Stability — Test Coverage" />
          <p style={{ ...prose, marginBottom: 20 }}>
            The compounding projections, CVaR risk models, and governance mechanisms described
            here are only credible if the underlying code is verified to be correct.
            A test suite with 90%+ overall coverage and 100% critical path coverage is not
            a development convenience — it is a fiduciary requirement.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8, marginBottom: 20 }}>
            {[
              { label: "Unit Test Files",       value: "27",    color: "var(--green)" },
              { label: "Integration Files",     value: "7",     color: "var(--blue)"  },
              { label: "Critical Path",         value: "100%",  color: "var(--green)" },
              { label: "Overall Target",        value: "≥ 90%", color: "var(--green)" },
            ].map(({ label, value, color }) => (
              <div key={label} className="card" style={{ padding: "16px 14px" }}>
                <span className="label-xs" style={{ display: "block", marginBottom: 8 }}>{label}</span>
                <span className="mono" style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {[
              { tier: "Tier 1 — Unit Tests", chip: "chip-green", body: "Component isolation with exhaustive parametrisation. Every mathematical branch of the action generator (19 branches), all Z-score edge cases, all Monte Carlo computation paths, and a 100-simultaneous-event concurrency stress matrix on the NativeMemory engine." },
              { tier: "Tier 2 — Integration Tests", chip: "chip-blue", body: "Three integration strata: (a) Mocked — fast, deterministic, 19 branches; (b) Semi-mocked — real Supabase + mocked broker, validates data persistence; (c) Unmocked — full stack except broker WebSocket. Deterministic timeout loops replace sleep calls." },
              { tier: "Tier 3 — Critical Path (100%)", chip: "chip-amber", body: "The complete trade lifecycle: ingestion → cleaning → analytics → performance inference → action generation → order persistence → memory routing → PubSub broadcast → batch flush. Every stage of a live trade from WebSocket receipt to database write is verified." },
            ].map(({ tier, chip, body }) => (
              <div key={tier} className="card" style={{ padding: 20 }}>
                <span className={`chip ${chip}`} style={{ marginBottom: 12 }}>{tier}</span>
                <p style={{ ...sub, marginTop: 8 }}>{body}</p>
              </div>
            ))}
          </div>

          <p style={sub}>
            E2E integration tests operate against a live Supabase AWS cluster using a deterministic
            test ID offset (99000+) to prevent contamination of production data. Each test includes
            atomic cleanup — every record written is verified to exist, then purged.
          </p>

          {/* ── Navigation ────────────────────────────────── */}
          <div style={{ display: "flex", gap: 12, marginTop: 52, flexWrap: "wrap" }}>
            <Link href="/model" className="btn btn-primary">Run Simulation →</Link>
            <Link href="/data"  className="btn btn-secondary">View Data →</Link>
            <Link href="/"      className="btn btn-secondary">← Overview</Link>
          </div>

        </div>{/* end content */}
      </div>{/* end layout */}
    </div>
  );
}
