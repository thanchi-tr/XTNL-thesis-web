import type { Metadata } from "next";
import RDistributionChart from "@/components/RDistributionChart";
import HourlyHeatmap from "@/components/HourlyHeatmap";
import SQNBenchmark from "@/components/data/SQNBenchmark";
import DrawdownProfile from "@/components/data/DrawdownProfile";
import Link from "next/link";

export const metadata: Metadata = { title: "Data" };

function StatRow({ label, value, note, color = "var(--ink-0)" }: {
  label: string; value: string; note?: string; color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
        padding: "11px 0",
        borderBottom: "1px solid var(--line)",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "var(--ink-2)" }}>{label}</span>
        {note && <span className="chip chip-muted" style={{ fontSize: 9 }}>{note}</span>}
      </div>
      <span className="mono" style={{ fontSize: 14, fontWeight: 700, color, flexShrink: 0 }}>{value}</span>
    </div>
  );
}

function DatasetCard({
  title, chip, chipLabel, health, rows,
}: {
  title: string; chip: string; chipLabel: string; health: string; rows: [string, string, string?][];
}) {
  return (
    <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <p
          className="mono"
          style={{ fontSize: 10, color: "var(--ink-2)", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" }}
        >
          {title}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className={`chip ${chip}`}>{chipLabel}</span>
          <span className="chip chip-muted">{health}</span>
        </div>
      </div>
      <div>
        {rows.map(([k, v, note]) => (
          <StatRow key={k} label={k} value={v} note={note} color={v.startsWith("−") || v.startsWith("-") ? "var(--red)" : "var(--ink-0)"} />
        ))}
      </div>
    </div>
  );
}

export default function DataPage() {
  return (
    <div className="site-container" style={{ paddingTop: 48, paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ marginBottom: 48, maxWidth: 700 }}>
        <p className="section-eyebrow" style={{ marginBottom: 14 }}>Production Analytics</p>
        <h1
          style={{
            fontSize: "clamp(24px, 4vw, 44px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--ink-0)",
            marginBottom: 16,
            lineHeight: 1.1,
          }}
        >
          System Performance Data
        </h1>
        <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.8 }}>
          All metrics reported directly from the XTNL analytics pipeline. Dataset labels
          correspond to the internal subset naming convention. Live execution (N=29) reflects
          the current deployment phase; SESSION_FILTERED (N=106) and FULL_OPTIMAL (N=308)
          span the complete forward-test universe.
        </p>
      </div>

      {/* ── Dataset overview cards ─────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
          marginBottom: 28,
        }}
      >
        <DatasetCard
          title="SESSION_FILTERED_OPTIMAL_SAMPLE"
          chip="chip-green" chipLabel="SQN 4.253" health="[ELITE]"
          rows={[
            ["Sample Size",        "N = 106"],
            ["Expectancy (μ)",     "0.982 R"],
            ["Std Error",         "0.231 R"],
            ["95% CI Lower",      "0.529 R"],
            ["Sortino Ratio",     "1.356"],
            ["Rolling SQN (Wtd)", "4.377"],
            ["Profit Factor",     "3.109×"],
            ["Skew / Kurtosis",   "0.869 / −0.153"],
            ["Max DD Duration",   "12 trades"],
            ["MC 95% CVaR",       "−13.711 R"],
            ["Recommend R",       "0.70%"],
            ["R Velocity 24h",    "6.052 R"],
          ]}
        />

        <DatasetCard
          title="FULL_OPTIMAL_SAMPLE"
          chip="chip-green" chipLabel="SQN 5.211" health="[SUPERB]"
          rows={[
            ["Sample Size",        "N = 308"],
            ["Expectancy (μ)",     "0.693 R"],
            ["Std Error",         "0.133 R"],
            ["95% CI Lower",      "0.432 R"],
            ["Sortino Ratio",     "0.930"],
            ["Rolling SQN (Wtd)", "3.881"],
            ["Profit Factor",     "2.39×"],
            ["Skew / Kurtosis",   "1.432 / 2.099"],
            ["Max DD Duration",   "24 trades"],
            ["MC 95% CVaR",       "−21.02 R"],
            ["Recommend R",       "0.50%"],
            ["R Velocity 24h",    "2.706 R"],
          ]}
        />

        <DatasetCard
          title="LIVE_SESSION_FILTERED — Current Deploy"
          chip="chip-amber" chipLabel="SQN 0.064" health="[CAUTION]"
          rows={[
            ["Live Trade Count",   "N = 29"],
            ["Expectancy (μ)",     "0.027 R"],
            ["Std Error",         "0.415 R"],
            ["95% CI Lower",      "−0.787 R"],
            ["Sortino Ratio",     "0.026"],
            ["Rolling SQN (Wtd)", "−0.336"],
            ["Profit Factor",     "1.033×"],
            ["Skew / Kurtosis",   "1.741 / 2.205"],
            ["Max DD Duration",   "15 trades"],
            ["MC 95% CVaR",       "−24.946 R"],
            ["WFO Status",        "INSUFFICIENT_DATA", "< 100 trades"],
          ]}
        />
      </div>

      {/* CAUTION note */}
      <div
        className="card"
        style={{ padding: "14px 20px", borderLeft: "3px solid var(--amber)", marginBottom: 32 }}
      >
        <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.7 }}>
          <strong style={{ color: "var(--amber)" }}>LIVE dataset context:</strong>{" "}
          N=29 live trades is statistically insufficient for edge confirmation. The [CAUTION] health
          status is expected and appropriate at this stage of deployment. The SESSION_FILTERED dataset
          (N=106) provides the validated statistical baseline from the forward-test period.
          WFO validation on the live dataset requires a minimum of 100 trades.
        </p>
      </div>

      {/* ── Additional datasets ───────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
          marginBottom: 28,
        }}
      >
        <DatasetCard
          title="RECENT_100_SESSION_FILTERED"
          chip="chip-green" chipLabel="SQN 3.977" health="[ELITE]"
          rows={[
            ["Sample Size",     "N = 100"],
            ["Expectancy (μ)",  "0.914 R"],
            ["Profit Factor",   "2.93×"],
            ["Max DD Duration", "26 trades"],
            ["MC 95% CVaR",     "−12.632 R"],
            ["Recommend R",     "0.80%"],
            ["WFO Status",      "STABLE - OPERATIONAL_EDGE"],
          ]}
        />

        <DatasetCard
          title="RECENT_200_FULL_OPTIMAL"
          chip="chip-green" chipLabel="SQN 4.665" health="[ELITE]"
          rows={[
            ["Sample Size",     "N = 200"],
            ["Expectancy (μ)",  "0.815 R"],
            ["Profit Factor",   "2.64×"],
            ["Max DD Duration", "30 trades"],
            ["MC 95% CVaR",     "−16.902 R"],
            ["Recommend R",     "0.60%"],
            ["WFO Status",      "ELITE - FULL_CAPITAL_DEPLOYMENT"],
          ]}
        />

        <DatasetCard
          title="95R_SESSION_FILTERED (Outliers Excl.)"
          chip="chip-green" chipLabel="SQN 4.282" health="[ELITE]"
          rows={[
            ["Sample Size",     "N = 300"],
            ["Expectancy (μ)",  "0.493 R"],
            ["Profit Factor",   "1.963×"],
            ["Max DD Duration", "24 trades"],
            ["MC 95% CVaR",     "−24.065 R"],
            ["Recommend R",     "0.40%"],
            ["WFO Status",      "ELITE - FULL_CAPITAL_DEPLOYMENT"],
          ]}
        />
      </div>

      {/* ── HMM Regime breakdown ─────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
          marginBottom: 28,
        }}
      >
        <DatasetCard
          title="REGIME: ALPHA_FLOW"
          chip="chip-green" chipLabel="SQN 3.210" health="[ROBUST]"
          rows={[
            ["Sample Size",     "N = 93"],
            ["Expectancy (μ)",  "0.820 R"],
            ["Profit Factor",   "2.616×"],
            ["Max DD Duration", "13 trades"],
            ["MC 95% CVaR",     "−16.154 R"],
            ["Recommend R",     "0.60%"],
          ]}
        />

        <DatasetCard
          title="REGIME: TOXIC_FATIGUE"
          chip="chip-red" chipLabel="SQN 4.105" health="[ROBUST]"
          rows={[
            ["Sample Size",     "N = 215"],
            ["Expectancy (μ)",  "0.638 R"],
            ["Profit Factor",   "2.29×"],
            ["Max DD Duration", "31 trades"],
            ["MC 95% CVaR",     "−20.699 R"],
            ["Recommend R",     "0.50%"],
            ["WFO Status",      "STABLE - OPERATIONAL_EDGE"],
          ]}
        />
      </div>

      <p style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 32, lineHeight: 1.6 }}>
        HMM regime labels are assigned by the Gaussian Hidden Markov Model oracle using
        expectancy Z-score, execution density, and diurnal fatigue features. ALPHA_FLOW
        represents the high-performance regime; TOXIC_FATIGUE represents the degraded regime.
        Notably, both regimes show positive expectancy — regime detection is used to calibrate
        risk allocation, not to halt trading.
      </p>

      {/* ── R Distribution ───────────────────────────────── */}
      <RDistributionChart />

      {/* ── Hourly Heatmap ───────────────────────────────── */}
      <HourlyHeatmap />

      {/* ── SQN Benchmark ────────────────────────────────── */}
      <SQNBenchmark />

      {/* ── Drawdown Profile ─────────────────────────────── */}
      <DrawdownProfile />

      {/* ── WFO Table — SESSION_FILTERED ─────────────────── */}
      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <p className="section-eyebrow" style={{ marginBottom: 6 }}>
          Walk-Forward Optimisation — SESSION_FILTERED (N=106)
        </p>
        <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 20, lineHeight: 1.7 }}>
          Expanding-window validation. Each fold trains on historical data then tests on the
          immediately following unseen period. Aggregate result determines operational status.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {["Stage", "Train N", "Test N", "IS SQN", "OOS SQN", "IS E", "OOS E", "Degradation", "Status"].map((h) => (
                  <th
                    key={h}
                    className="mono"
                    style={{
                      padding: "10px 12px", textAlign: "left",
                      fontSize: 9, letterSpacing: "0.10em", textTransform: "uppercase",
                      color: "var(--ink-2)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Fold 1", "22",  "21",  "2.248", "1.853", "1.280", "0.889", "17.56%",   null,           "chip-blue"],
                ["Fold 2", "43",  "21",  "2.938", "3.059", "1.089", "1.583", "−4.11%",   null,           "chip-green"],
                ["Fold 3", "64",  "21",  "4.163", "0.937", "1.251", "0.457", "77.50%",   null,           "chip-red"],
                ["Fold 4", "85",  "21",  "4.094", "1.300", "1.055", "0.686", "68.26%",   null,           "chip-amber"],
                ["Aggregate", "—", "—",  "—",     "1.787", "—",     "0.904", "—",         "STABLE - OPERATIONAL_EDGE", "chip-green"],
              ].map(([stage, tr, te, is_, oos_, ise, oose, deg, status, chipColor]) => (
                <tr key={stage as string} style={{ background: "var(--card)" }}>
                  <td className="mono" style={{ padding: "11px 12px", borderBottom: "1px solid var(--line)", color: "var(--ink-1)", fontWeight: stage === "Aggregate" ? 700 : 400 }}>{stage}</td>
                  <td className="mono" style={{ padding: "11px 12px", borderBottom: "1px solid var(--line)", color: "var(--ink-2)" }}>{tr}</td>
                  <td className="mono" style={{ padding: "11px 12px", borderBottom: "1px solid var(--line)", color: "var(--ink-2)" }}>{te}</td>
                  <td className="mono" style={{ padding: "11px 12px", borderBottom: "1px solid var(--line)", color: "var(--blue)" }}>{is_}</td>
                  <td className="mono" style={{ padding: "11px 12px", borderBottom: "1px solid var(--line)", color: String(oos_).startsWith("0.9") || String(oos_).startsWith("3") || String(oos_).startsWith("1.8") ? "var(--green)" : "var(--amber)" }}>{oos_}</td>
                  <td className="mono" style={{ padding: "11px 12px", borderBottom: "1px solid var(--line)", color: "var(--ink-2)" }}>{ise}</td>
                  <td className="mono" style={{ padding: "11px 12px", borderBottom: "1px solid var(--line)", color: "var(--green)" }}>{oose}</td>
                  <td className="mono" style={{ padding: "11px 12px", borderBottom: "1px solid var(--line)", color: (deg as string).startsWith("−") ? "var(--green)" : (deg as string).startsWith("7") || (deg as string).startsWith("6") ? "var(--red)" : "var(--ink-1)" }}>{deg}</td>
                  <td style={{ padding: "11px 12px", borderBottom: "1px solid var(--line)" }}>
                    {status ? <span className={`chip ${chipColor}`}>{status}</span> : <span style={{ color: "var(--ink-3)", fontSize: 11 }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 14, lineHeight: 1.6 }}>
          Fold 3 (77.5% degradation) and Fold 4 (68.26%) reflect the WFO pressure that prompted
          temporal quarantine of the 19:00 AEST cluster. The filtered dataset recovers to STABLE status.
        </p>
      </div>

      {/* ── Inferred (Current Week) ───────────────────────── */}
      <div className="card" style={{ padding: 24, marginBottom: 28 }}>
        <p className="section-eyebrow" style={{ marginBottom: 16 }}>Current-Week Inferred Metrics</p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 1,
            background: "var(--line)",
            border: "1px solid var(--line)",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          {[
            ["Realised R",        "5.782 R"],
            ["Perfect Execute R", "10.693 R"],
            ["Capture Rate",      "100%"],
            ["Efficiency Rating", "82.2%"],
            ["Bad Trade %",       "33.3%"],
            ["Recommend R",       "0.509% (RISK REDUCE)"],
            ["Z — Actual/System", "−0.438"],
            ["Z — Week/System",   "0.042"],
            ["Status",            "RISK REDUCE — Frictional Bleed"],
          ].map(([k, v]) => (
            <div key={k as string} style={{ background: "var(--card)", padding: "14px 16px" }}>
              <span className="label-xs" style={{ display: "block", marginBottom: 6 }}>{k}</span>
              <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: (v as string).includes("REDUCE") ? "var(--amber)" : "var(--ink-0)" }}>{v}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 14, lineHeight: 1.6 }}>
          Current-week inferred metrics reflect live performance relative to the theoretical
          optimal execution baseline. RISK REDUCE status triggers an automatic position size
          reduction via the performance-gating mechanism.
        </p>
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/model"      className="btn btn-secondary">Run the Simulator →</Link>
        <Link href="/prospectus" className="btn btn-secondary">Read the Prospectus →</Link>
      </div>
    </div>
  );
}
