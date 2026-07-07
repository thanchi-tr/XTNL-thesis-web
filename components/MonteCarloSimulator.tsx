"use client";

import { useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, AreaChart, Area,
  BarChart, Bar, Cell,
} from "recharts";
import { formatMultiple, type SimParams } from "@/lib/simulation";
import SliderControl from "@/components/ui/SliderControl";
import { useSimulator } from "@/context/SimulatorContext";

/* ─── Presets ──────────────────────────────────────────────── */
const PRESETS = [
  { label: "Baseline",    p: { operatorMeanEff: 0.82, edgeDecayPctPerQtr: 3,   baseRiskPct: 0.70 } },
  { label: "Pessimistic", p: { operatorMeanEff: 0.70, edgeDecayPctPerQtr: 6,   baseRiskPct: 0.50 } },
  { label: "Optimistic",  p: { operatorMeanEff: 0.92, edgeDecayPctPerQtr: 1.5, baseRiskPct: 0.85 } },
];

/* ─── Module-level helpers ─────────────────────────────────── */
const fmtEq = (v: number) =>
  v >= 1e6  ? `${(v/1e6).toFixed(1)}M×`
  : v >= 1000 ? `${(v/1000).toFixed(0)}K×`
  : `${v.toFixed(2)}×`;

/* ─── Sub-components ───────────────────────────────────────── */
function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: sub ? 4 : 0 }}>
        <span style={{ width: 2, height: 10, borderRadius: 1, background: "rgba(0,204,122,0.65)", flexShrink: 0 }} />
        <p className="label-xs" style={{ color: "var(--ink-1)" }}>{title}</p>
      </div>
      {sub && <p style={{ fontSize: 10, color: "rgba(142,163,190,0.40)", lineHeight: 1.5, paddingLeft: 9 }}>{sub}</p>}
    </div>
  );
}

function InfoBadge({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0" }}>
      <span style={{ fontSize: 10, color: "rgba(142,163,190,0.65)" }}>{label}</span>
      <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,204,122,0.75)" }}>{value}</span>
    </div>
  );
}

function StatCard({ label, value, accent = "#00cc7a", sub }: {
  label: string; value: string; accent?: string; sub?: string;
}) {
  return (
    <div className="card" style={{ padding: "12px 10px", minWidth: 0 }}>
      <span className="label-xs" style={{ display: "block", marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <span className="mono" style={{ fontSize: 15, fontWeight: 800, color: accent, lineHeight: 1, display: "block" }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: 8, color: "rgba(142,163,190,0.5)", marginTop: 3, display: "block" }}>{sub}</span>
      )}
    </div>
  );
}

/* ─── Tooltips ─────────────────────────────────────────────── */
function ChartTip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: number }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#07101c", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, padding: "10px 14px", fontFamily: "ui-monospace,monospace", boxShadow: "0 12px 40px rgba(0,0,0,0.8)" }}>
      <p style={{ fontSize: 10, color: "rgba(142,163,190,0.65)", marginBottom: 5 }}>Week {label}</p>
      <p style={{ fontSize: 15, color: "var(--ink-0)", fontWeight: 700 }}>{payload[0].value.toFixed(3)}×</p>
    </div>
  );
}

function FanTip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: number }) {
  if (!active || !payload?.length) return null;
  const get = (k: string) => payload.find(p => p.dataKey === k)?.value;
  const rows: [string, number | undefined, string][] = [
    ["P95", get("p95"), "#4d9cf5"],
    ["P75", get("p75"), "rgba(0,204,122,0.8)"],
    ["P50 Median", get("p50"), "#00cc7a"],
    ["P25", get("p25"), "rgba(240,160,48,0.8)"],
    ["P5",  get("p5"),  "#f03a57"],
  ];
  return (
    <div style={{ background: "#07101c", border: "1px solid rgba(0,204,122,0.15)", borderRadius: 6, padding: "10px 14px", fontFamily: "ui-monospace,monospace", boxShadow: "0 12px 40px rgba(0,0,0,0.8)", minWidth: 168 }}>
      <p style={{ fontSize: 10, color: "rgba(142,163,190,0.65)", marginBottom: 7 }}>Week {label}</p>
      {rows.map(([k, v, c]) => v !== undefined && (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 3 }}>
          <span style={{ fontSize: 9, color: c }}>{k}</span>
          <span style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>{fmtEq(v)}</span>
        </div>
      ))}
    </div>
  );
}

function EffTip({ active, payload, label }: { active?: boolean; payload?: { value: number; dataKey?: string }[]; label?: number }) {
  if (!active || !payload?.length) return null;
  const eff = payload.find(p => p.dataKey === "eff")?.value ?? 0;
  const reg = payload.find(p => p.dataKey === "regime")?.value ?? 1;
  const tier = eff >= 0.95 ? "Excellence" : eff >= 0.80 ? "Normal" : eff >= 0.50 ? "Reduced" : "Critical/Halt";
  const c    = eff >= 0.95 ? "#00e88c" : eff >= 0.80 ? "#00cc7a" : eff >= 0.50 ? "#f0a030" : "#f03a57";
  return (
    <div style={{ background: "#07101c", border: `1px solid ${c}35`, borderRadius: 6, padding: "12px 14px", fontFamily: "ui-monospace,monospace", boxShadow: "0 12px 40px rgba(0,0,0,0.8)", minWidth: 160 }}>
      <p style={{ fontSize: 10, color: "rgba(142,163,190,0.65)", marginBottom: 8 }}>Week {label}</p>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 5 }}>
        <span style={{ fontSize: 10, color: "rgba(142,163,190,0.65)" }}>Efficiency</span>
        <span className="mono" style={{ fontSize: 13, color: c, fontWeight: 800 }}>{(eff*100).toFixed(1)}%</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: "rgba(142,163,190,0.65)" }}>Regime Penalty</span>
        <span className="mono" style={{ fontSize: 13, color: reg < 1 ? "#f03a57" : "#8ea3be", fontWeight: 700 }}>{reg.toFixed(2)}×</span>
      </div>
      <p style={{ fontSize: 9, color: c, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" }}>{tier}</p>
    </div>
  );
}

function HistTip({ active, payload }: { active?: boolean; payload?: { payload: { label: string; count: number; isMedian: boolean } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: "#07101c", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "8px 12px", fontFamily: "ui-monospace,monospace" }}>
      <p style={{ fontSize: 10, color: "rgba(142,163,190,0.65)", marginBottom: 3 }}>{d.label}</p>
      <p style={{ fontSize: 13, color: d.isMedian ? "#00cc7a" : "var(--ink-0)", fontWeight: 700 }}>
        {d.count} paths{d.isMedian ? " ← median" : ""}
      </p>
    </div>
  );
}

function DDHistTip({ active, payload }: { active?: boolean; payload?: { payload: { label: string; count: number; isMean: boolean } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: "#07101c", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "8px 12px", fontFamily: "ui-monospace,monospace" }}>
      <p style={{ fontSize: 10, color: "rgba(142,163,190,0.65)", marginBottom: 3 }}>Max DD ~{d.label}</p>
      <p style={{ fontSize: 13, color: d.isMean ? "#f03a57" : "var(--ink-0)", fontWeight: 700 }}>
        {d.count} paths{d.isMean ? " ← mean" : ""}
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════════════ */
export default function MonteCarloSimulator() {
  const { params: p, result: res, running, setParam, setParams, rerun } = useSimulator();
  const { data: session } = useSession();
  const authed = Boolean((session as any)?.twoFactorVerified);

  /* ── Spaghetti chart data (logged-out) — sampled for perf ── */
  // 40 paths × ~65 x-points = ~2,600 SVG segments (vs 200 × 260 = 52,000)
  const { spaghettiData, spaghettiKeys } = useMemo(() => {
    if (!res || authed) return { spaghettiData: [], spaghettiKeys: [] };
    const MAX_PATHS = 40;
    const weekStep  = Math.max(1, Math.floor(p.weeks / 65));
    const pathStep  = Math.max(1, Math.floor(res.paths.length / MAX_PATHS));
    const sampled   = res.paths.filter((_, i) => i % pathStep === 0).slice(0, MAX_PATHS);
    const keys      = sampled.map((_, i) => `p${i}`);
    const data: Record<string, number>[] = [];
    for (let w = 0; w < p.weeks; w += weekStep) {
      const pt: Record<string, number> = { week: w + 1 };
      sampled.forEach((path, i) => { if (path[w] !== undefined) pt[keys[i]] = path[w]; });
      data.push(pt);
    }
    return { spaghettiData: data, spaghettiKeys: keys };
  }, [res, p.weeks, authed]);

  const buildEffData = useCallback((effSamples: number[][], regSamples: number[][], weeks: number) => {
    const medEff = effSamples[Math.floor(effSamples.length / 2)] ?? effSamples[0];
    const medReg = regSamples[Math.floor(regSamples.length / 2)] ?? regSamples[0];
    return Array.from({ length: weeks }, (_, w) => ({
      week: w + 1,
      eff:   medEff[w] ?? 0.82,
      regime: medReg[w] ?? 1.0,
    }));
  }, []);

  /* ── Percentile fan data (authed only) ────────────────── */
  const fanData = useMemo(() => {
    if (!res || !authed) return [];
    return Array.from({ length: p.weeks }, (_, w) => {
      const vals = res.paths.map(path => Math.max(0.01, path[w] ?? 1)).sort((a, b) => a - b);
      const n = vals.length;
      const q = (t: number) => vals[Math.min(Math.floor(n * t), n - 1)] ?? 1;
      return { week: w + 1, p5: q(0.05), p25: q(0.25), p50: q(0.50), p75: q(0.75), p95: q(0.95) };
    });
  }, [res, p.weeks, authed]);

  /* ── Terminal distribution histogram (authed only) ─────── */
  const histData = useMemo(() => {
    if (!res || !authed) return [];
    const BINS = 18;
    const vals = res.paths.map(path => Math.max(0.01, path[p.weeks - 1] ?? 1));
    const sorted = [...vals].sort((a, b) => a - b);
    const lo = sorted[0], hi = sorted[sorted.length - 1];
    const range = (hi - lo) || 1;
    const bins = Array.from({ length: BINS }, (_, i) => ({
      label: fmtEq(lo + (i + 0.5) * (range / BINS)),
      count: 0, isMedian: false,
    }));
    for (const v of vals) {
      const idx = Math.min(Math.floor(((v - lo) / range) * BINS), BINS - 1);
      bins[idx].count++;
    }
    const medIdx = Math.min(Math.floor(((res.medianTerminal - lo) / range) * BINS), BINS - 1);
    if (bins[medIdx]) bins[medIdx].isMedian = true;
    return bins;
  }, [res, p.weeks, authed]);

  /* ── Year-end milestones (authed only) ────────────────── */
  const yearData = useMemo(() => {
    if (!fanData.length) return [];
    const maxYears = Math.min(Math.floor(p.weeks / 52), 10);
    return Array.from({ length: maxYears }, (_, i) => {
      const d = fanData[(i + 1) * 52 - 1];
      if (!d) return null;
      return { year: i + 1, p5: d.p5, p50: d.p50, p95: d.p95 };
    }).filter(Boolean) as { year: number; p5: number; p50: number; p95: number }[];
  }, [fanData, p.weeks]);

  /* ── Analyst metrics (authed only) ───────────────────── */
  const analystMetrics = useMemo(() => {
    if (!res || !authed || !fanData.length) return null;
    const years       = p.weeks / 52;
    const annualCAGR  = Math.pow(Math.max(0.001, res.medianTerminal), 1 / years) - 1;
    const calmar      = res.meanMaxDD > 0 ? annualCAGR / res.meanMaxDD : 99;
    const edgeHalfLifeQtr = p.edgeDecayPctPerQtr > 0.01
      ? Math.log(0.5) / Math.log(1 - p.edgeDecayPctPerQtr / 100)
      : Infinity;
    const m2  = fanData.findIndex(d => d.p50 >= 2);
    const m5  = fanData.findIndex(d => d.p50 >= 5);
    const m10 = fanData.findIndex(d => d.p50 >= 10);
    const constraint =
      p.edgeDecayPctPerQtr > 5                                          ? "Edge decay" :
      res.effStats.pctCritical + res.effStats.pctHalted > 15            ? "Operator efficiency" :
      res.regimeStats.pctHaircut + res.regimeStats.pctToxic > 20        ? "Regime clustering" :
      res.pctRuined > 10                                                 ? "Capital ruin risk" : null;
    const verdict =
      res.pctRuined > 20   ? "UNVIABLE"      :
      res.pctRuined > 10   ? "HIGH RISK"     :
      calmar < 0.5         ? "WEAK RISK-ADJ" :
      calmar > 1.5 && res.pctRuined < 5 ? "VIABLE" : "MARGINAL";
    const verdictColor =
      verdict === "VIABLE"      ? "#00cc7a" :
      verdict === "UNVIABLE"    ? "#f03a57" :
      verdict === "HIGH RISK"   ? "#f03a57" : "#f0a030";
    return { annualCAGR, calmar, edgeHalfLifeQtr, m2, m5, m10, constraint, verdict, verdictColor };
  }, [res, authed, fanData, p]);

  /* ── DD histogram from 200 sampled paths (authed only) ─ */
  const ddHistData = useMemo(() => {
    if (!res || !authed) return [];
    const BINS = 14;
    const dds = res.paths.map(path => {
      let peak = 1, maxDD = 0;
      for (const eq of path) {
        if (eq > peak) peak = eq;
        const dd = peak > 0 ? (peak - eq) / peak : 0;
        if (dd > maxDD) maxDD = dd;
      }
      return maxDD * 100;
    });
    const sorted = [...dds].sort((a, b) => a - b);
    const lo = Math.max(0, sorted[0] ?? 0);
    const hi = sorted[sorted.length - 1] ?? 100;
    const range = Math.max(1, hi - lo);
    const bins = Array.from({ length: BINS }, (_, i) => ({
      label: `${(lo + (i + 0.5) * range / BINS).toFixed(0)}%`,
      count: 0, isMean: false,
    }));
    for (const dd of dds) {
      const idx = Math.min(Math.floor(((dd - lo) / range) * BINS), BINS - 1);
      if (bins[idx]) bins[idx].count++;
    }
    const meanIdx = Math.min(Math.floor(((res.meanMaxDD * 100 - lo) / range) * BINS), BINS - 1);
    if (bins[meanIdx]) bins[meanIdx].isMean = true;
    return bins;
  }, [res, authed]);

  /* ── Derived values ───────────────────────────────────── */
  const effData = useMemo(() => res ? buildEffData(res.effPathSamples, res.regPathSamples, p.weeks) : [], [res, p.weeks, buildEffData]);

  const update      = useCallback((key: keyof SimParams, val: number) => setParam(key, val), [setParam]);
  const applyPreset = (preset: Partial<SimParams>) => setParams({ ...p, ...preset });
  const yFmt         = (v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}K×` : `${v.toFixed(1)}×`;
  const liveEff      = p.operatorMeanEff;
  const liveReg      = res?.meanRegimePenalty ?? 1.0;
  const livePerfMult = liveEff < 0.40 ? 0 : liveEff < 0.50 ? 0.30 : liveEff < 0.80 ? 0.60 : liveEff >= 0.95 ? 1.18 : 1.0;
  const liveApplied  = (p.baseRiskPct * livePerfMult * liveReg * 0.95).toFixed(3);

  /* ─── XAxis interval helper ─────────────────────────────── */
  const xInterval = Math.floor(p.weeks / 8);

  return (
    <div className="card" style={{ overflow: "hidden", boxShadow: "var(--shadow-lg)" }}>

      {/* ── Risk formula strip (authed only) ─────────────── */}
      {authed && (
      <div style={{ padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#060d16" }}>
        <p className="label-xs" style={{ marginBottom: 6, color: "rgba(0,204,122,0.6)" }}>
          XTNL Risk Allocation Formula (mirrors recommend_r_generator.py)
        </p>
        <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 11, lineHeight: 2.0, flexWrap: "wrap", display: "flex", gap: "0 4px", alignItems: "baseline" }}>
          <span style={{ color: "rgba(142,163,190,0.7)" }}>final_risk =</span>
          <span style={{ color: "#00cc7a" }}> {p.baseRiskPct.toFixed(2)}%</span>
          <span style={{ color: "rgba(142,163,190,0.5)" }}> × perf_mult(eff)</span>
          <span style={{ color: "#4d9cf5" }}> {livePerfMult.toFixed(2)}</span>
          <span style={{ color: "rgba(142,163,190,0.5)" }}> × regime_penalty</span>
          <span style={{ color: liveReg < 1 ? "#f03a57" : "rgba(142,163,190,0.7)" }}> {liveReg.toFixed(3)}</span>
          <span style={{ color: "rgba(142,163,190,0.5)" }}> × 0.95 =</span>
          <span style={{ color: "#00e88c", fontWeight: 800 }}> {liveApplied}%</span>
        </div>
      </div>
      )}

      {/* ── Presets ──────────────────────────────────────── */}
      <div style={{ padding: "8px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span className="label-xs" style={{ marginRight: 4 }}>Scenario:</span>
        {PRESETS.map(({ label, p: preset }) => (
          <button key={label} className="btn btn-ghost" style={{ fontSize: 10, padding: "4px 12px" }} onClick={() => applyPreset(preset)}>
            {label}
          </button>
        ))}
        {!authed && (
          <span className="label-xs" style={{ marginLeft: "auto", color: "rgba(142,163,190,0.30)" }}>
            Preset-only
          </span>
        )}
      </div>

      <div className="sim-body">

        {/* ══════════════════════════════════════════════
            CONTROLS SIDEBAR
            ══════════════════════════════════════════════ */}
        <div className="sim-controls" style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Simplified view for unauthenticated users */}
          {!authed && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ margin: 0, fontSize: 11, color: "rgba(142,163,190,0.55)", lineHeight: 1.65 }}>
                Select a scenario above, then run the simulation. Outcomes update immediately.
              </p>
              <a href="/api/auth/signin" style={{ fontSize: 10.5, color: "var(--green)", textDecoration: "none" }}>
                Sign in to adjust parameters →
              </a>
            </div>
          )}
          {authed && (<>

          {/* ── Operator ─────────────────────────────── */}
          <div>
            <SectionHead title="Operator (OU Process)" sub="Mean-reverting OU · θ=0.35, σ=7.5% · shocks persist ~3 weeks" />
            <SliderControl
              label="Mean Efficiency μ_eff"
              value={p.operatorMeanEff}
              displayValue={`${(p.operatorMeanEff*100).toFixed(0)}%`}
              min={0.60} max={0.98} step={0.01}
              tooltip="Long-run mean the OU process reverts toward. Live system: 82.2%."
              onChange={(v) => update("operatorMeanEff", v)}
              readOnly={!authed}
            />
            <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(0,204,122,0.04)", borderRadius: 4, border: "1px solid rgba(0,204,122,0.10)" }}>
              <InfoBadge label="OU reversion speed (θ)" value="0.35" />
              <InfoBadge label="OU weekly volatility (σ)" value="7.5%" />
              <InfoBadge label="Hard floor" value="40%" />
            </div>
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />

          {/* ── Edge ─────────────────────────────────── */}
          <div>
            <SectionHead title="Edge Parameters" sub="Trades simulated individually per week · MC95 losing streak = 12 trades" />
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <SliderControl label="Base Risk θ  (% of account)" value={p.baseRiskPct} displayValue={`${p.baseRiskPct.toFixed(2)}%`} min={0.1} max={2.0} step={0.01} tooltip="CVaR-derived position size per 1R trade. Live: 0.70%." onChange={(v) => update("baseRiskPct", v)} readOnly={!authed} />
              <SliderControl label="Expectancy μ  (R per trade)" value={p.expPerTrade} displayValue={`${p.expPerTrade.toFixed(3)} R`} min={0.1} max={2.0} step={0.01} tooltip="Mean R-multiple per trade. Erodes quarterly by edge decay. Live: 0.982 R." onChange={(v) => update("expPerTrade", v)} readOnly={!authed} />
              <SliderControl label="Trades / Week" value={p.tradesPerWeek} displayValue={`${p.tradesPerWeek}`} min={1} max={25} step={1} tooltip="Validated entries per week. Each trade is simulated individually for accurate losing-streak tracking." onChange={(v) => update("tradesPerWeek", v)} readOnly={!authed} />
              <SliderControl label="Volatility σ  (R per trade)" value={p.volPerTrade} displayValue={`${p.volPerTrade.toFixed(1)} R`} min={0.5} max={10} step={0.1} tooltip="Per-trade R std deviation. Higher = wider distribution of outcomes." onChange={(v) => update("volPerTrade", v)} readOnly={!authed} />
              <SliderControl label="Edge Decay  (% per quarter)" value={p.edgeDecayPctPerQtr} displayValue={`${p.edgeDecayPctPerQtr.toFixed(1)}%`} min={0} max={15} step={0.5} tooltip="Expectancy erodes every 13 weeks as the market adapts to the edge." onChange={(v) => update("edgeDecayPctPerQtr", v)} readOnly={!authed} />
            </div>
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />

          {/* ── Commission ───────────────────────────── */}
          <div>
            <SectionHead title="Commission Distribution" sub="Gate: eff ≥ 88% · deducted each qualifying week after start delay" />
            <SliderControl label="Distribution Starts  (week)" value={p.commissionStartWeek} displayValue={`W${p.commissionStartWeek} (Yr ${Math.ceil(p.commissionStartWeek/52)})`} min={0} max={260} step={4} tooltip="Weeks before commission payments begin." onChange={(v) => update("commissionStartWeek", v)} readOnly={!authed} />
            <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(0,204,122,0.04)", borderRadius: 4, border: "1px solid rgba(0,204,122,0.10)" }}>
              <InfoBadge label="Base rate" value="20% of recommend_r" />
              <InfoBadge label="Profit bonus" value="5% of realised_r (pos. weeks)" />
              <InfoBadge label="Excellence mult." value="1.5× when eff ≥ 95%" />
              <InfoBadge label="Gate" value="eff ≥ 88% · else zero" />
            </div>
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />

          {/* ── Capital Injection ────────────────────── */}
          <div>
            <SectionHead title="Capital Injection" sub="4-week gate · pool scales 1.20× with excellence · resets on fail" />
            <SliderControl label="Frozen Pool  (% of initial cap)" value={p.frozenPoolPct} displayValue={p.frozenPoolPct === 0 ? "Off" : `${(p.frozenPoolPct*100).toFixed(0)}% / period`} min={0} max={1.0} step={0.05} tooltip="Capital injected each qualifying 4-week period." onChange={(v) => update("frozenPoolPct", v)} readOnly={!authed} />
            {p.frozenPoolPct > 0 && (
              <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(0,204,122,0.04)", borderRadius: 4, border: "1px solid rgba(0,204,122,0.10)" }}>
                <InfoBadge label="Period length" value="Every 4 weeks" />
                <InfoBadge label="Qualification gate" value="ALL 4 weeks eff > 85%" />
                <InfoBadge label="Excellence scale" value="1.20× (any week eff > 95%)" />
                <InfoBadge label="Volatility shield" value="Scaling decays: 1.20 − 0.025×streak" />
                <InfoBadge label="Failure reset" value="Pool → baseline, streak = 0" />
              </div>
            )}
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />

          {/* ── Risk Controls ────────────────────────── */}
          <div>
            <SectionHead title="Risk Controls" />
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <SliderControl label="Tax Rate  (ATO annual)" value={p.taxRatePct} displayValue={`${p.taxRatePct.toFixed(0)}%`} min={0} max={47} step={1} tooltip="Applied to realised gains each year-end. 47% = ATO top marginal + 2% Medicare." onChange={(v) => update("taxRatePct", v)} readOnly={!authed} />
              <SliderControl label="DD Halt  (% threshold)" value={p.maxDDLimit} displayValue={p.maxDDLimit === 0 ? "Off" : `-${p.maxDDLimit}%`} min={0} max={60} step={5} tooltip="Halt a simulation path if drawdown exceeds this percentage from peak." onChange={(v) => update("maxDDLimit", v)} readOnly={!authed} />
              <SliderControl label="Horizon  (weeks)" value={p.weeks} displayValue={`${p.weeks}w · ${Math.round(p.weeks/52)}yr`} min={52} max={520} step={1} tooltip="Total simulation duration." onChange={(v) => update("weeks", v)} readOnly={!authed} />
            </div>
          </div>
          </>)}
        </div>

        {/* ══════════════════════════════════════════════
            CHART PANEL
            ══════════════════════════════════════════════ */}
        <div style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>

          {/* ── Analyst Verdict (authed) ──────────────── */}
          {authed && analystMetrics && (
            <div style={{
              background: "rgba(0,0,0,0.28)",
              border: `1px solid ${analystMetrics.verdictColor}25`,
              borderLeft: `3px solid ${analystMetrics.verdictColor}`,
              borderRadius: 7, padding: "14px 18px",
            }}>
              {/* Row 1: verdict + key risk-adj metrics */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap", marginBottom: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 90 }}>
                  <span className="label-xs">SYSTEM VERDICT</span>
                  <span className="mono" style={{ fontSize: 16, fontWeight: 800, color: analystMetrics.verdictColor, lineHeight: 1 }}>
                    {analystMetrics.verdict}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", flex: 1 }}>
                  {([
                    ["P50 CAGR",       `${(analystMetrics.annualCAGR * 100).toFixed(1)}%`,  "#00cc7a"],
                    ["CALMAR",         analystMetrics.calmar >= 99 ? "∞" : analystMetrics.calmar.toFixed(2), analystMetrics.calmar > 1.5 ? "#00cc7a" : analystMetrics.calmar > 0.8 ? "#f0a030" : "#f03a57"],
                    ["EDGE HALF-LIFE", analystMetrics.edgeHalfLifeQtr === Infinity ? "stable" : `${analystMetrics.edgeHalfLifeQtr.toFixed(0)} qtrs`, analystMetrics.edgeHalfLifeQtr < 20 ? "#f03a57" : analystMetrics.edgeHalfLifeQtr < 40 ? "#f0a030" : "#8ea3be"],
                    ["RUIN RATE",      `${res!.pctRuined.toFixed(1)}%`, res!.pctRuined > 10 ? "#f03a57" : res!.pctRuined > 5 ? "#f0a030" : "#00cc7a"],
                    ["WORST P50 DD",   `−${(res!.meanMaxDD * 100).toFixed(1)}%`, res!.meanMaxDD > 0.4 ? "#f03a57" : res!.meanMaxDD > 0.2 ? "#f0a030" : "#00cc7a"],
                  ] as [string, string, string][]).map(([label, value, color]) => (
                    <div key={label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <span className="label-xs">{label}</span>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 2: P50 time-to-milestone */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: analystMetrics.constraint ? 10 : 0, padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="label-xs" style={{ marginRight: 6 }}>P50 MILESTONE</span>
                {([
                  ["2×",  analystMetrics.m2],
                  ["5×",  analystMetrics.m5],
                  ["10×", analystMetrics.m10],
                ] as [string, number][]).map(([label, wk]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 4 }}>
                    <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-1)" }}>{label}</span>
                    <span className="mono" style={{ fontSize: 10, color: wk === -1 ? "rgba(142,163,190,0.35)" : "#4d9cf5" }}>
                      {wk === -1 ? "not reached" : `W${wk + 1} · Yr ${((wk + 1) / 52).toFixed(1)}`}
                    </span>
                  </div>
                ))}
              </div>

              {/* Row 3: binding constraint */}
              {analystMetrics.constraint && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="label-xs">BINDING CONSTRAINT</span>
                  <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: "#f0a030", letterSpacing: "0.06em" }}>
                    {analystMetrics.constraint}
                  </span>
                  <span style={{ fontSize: 10, color: "rgba(142,163,190,0.5)" }}>
                    {analystMetrics.constraint === "Edge decay"          && "— expectancy eroding faster than compounding can absorb"}
                    {analystMetrics.constraint === "Operator efficiency" && "— excessive time spent in reduced/critical tier"}
                    {analystMetrics.constraint === "Regime clustering"   && "— losing-streak haircuts consuming significant risk capacity"}
                    {analystMetrics.constraint === "Capital ruin risk"   && "— ruin probability above acceptable threshold"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Equity chart ──────────────────────────── */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
              <div>
                {authed ? (
                  <>
                    <p className="panel-title">Percentile Fan — 1,000 Paths</p>
                    <p className="label-xs" style={{ marginTop: 3 }}>
                      Log scale · P5/P25/P50/P75/P95 bands · Post-tax · Post-commission
                    </p>
                  </>
                ) : (
                  <>
                    <p className="panel-title">1,000-Iteration Equity Convergence</p>
                    <p className="label-xs" style={{ marginTop: 3 }}>
                      Log scale · Post-commission · Post-tax · OU operator + regime-gated risk
                    </p>
                  </>
                )}
              </div>
              <button className="btn btn-primary" style={{ fontSize: 10, padding: "7px 16px" }} onClick={rerun} disabled={running}>
                {running ? "Running…" : "Re-Run ↻"}
              </button>
            </div>

            {/* Fan chart — authed */}
            {authed && fanData.length > 0 && (
              <>
                {/* Legend */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginBottom: 8 }}>
                  {[
                    ["P95 (Bull)", "#4d9cf5", "4 3"],
                    ["P75",        "rgba(0,204,122,0.7)", "3 2"],
                    ["P50 Median", "#00cc7a", "none"],
                    ["P25",        "rgba(240,160,48,0.7)", "3 2"],
                    ["P5 (Bear)",  "#f03a57", "4 3"],
                  ].map(([label, c]) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 18, height: 1.5, background: c, display: "block", borderRadius: 1 }} />
                      <span style={{ fontSize: 9, color: "rgba(142,163,190,0.7)" }}>{label}</span>
                    </div>
                  ))}
                </div>
                <div style={{ height: 300, minHeight: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={fanData}>
                      <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: "rgba(142,163,190,0.7)", fontSize: 10, fontFamily: "ui-monospace,monospace" }} tickFormatter={(v) => `W${v}`} interval={xInterval} />
                      <YAxis scale="log" domain={["auto","auto"]} axisLine={false} tickLine={false} tick={{ fill: "rgba(142,163,190,0.7)", fontSize: 10, fontFamily: "ui-monospace,monospace" }} tickFormatter={yFmt} width={52} />
                      <Tooltip content={<FanTip />} cursor={{ stroke: "rgba(255,255,255,0.10)", strokeWidth: 1 }} />
                      {p.commissionStartWeek > 0 && p.commissionStartWeek <= p.weeks && (
                        <ReferenceLine x={p.commissionStartWeek} stroke="rgba(240,160,48,0.6)" strokeWidth={1} strokeDasharray="4 3"
                          label={{ value: "Comm. starts", fill: "#f0a030", fontSize: 9, fontFamily: "ui-monospace,monospace", position: "insideTopLeft" }} />
                      )}
                      <Line dataKey="p95" stroke="#4d9cf5" strokeWidth={1} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                      <Line dataKey="p75" stroke="rgba(0,204,122,0.65)" strokeWidth={1} strokeDasharray="3 2" dot={false} isAnimationActive={false} />
                      <Line dataKey="p50" stroke="#00cc7a" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                      <Line dataKey="p25" stroke="rgba(240,160,48,0.65)" strokeWidth={1} strokeDasharray="3 2" dot={false} isAnimationActive={false} />
                      <Line dataKey="p5"  stroke="#f03a57" strokeWidth={1} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {/* Spaghetti chart — logged-out (40 sampled paths × 65 x-points) */}
            {!authed && (
              <div style={{ height: 280, minHeight: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={spaghettiData}>
                    <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: "rgba(142,163,190,0.7)", fontSize: 10, fontFamily: "ui-monospace,monospace" }} tickFormatter={(v) => `W${v}`} interval={Math.floor(spaghettiData.length / 8)} />
                    <YAxis scale="log" domain={["auto","auto"]} axisLine={false} tickLine={false} tick={{ fill: "rgba(142,163,190,0.7)", fontSize: 10, fontFamily: "ui-monospace,monospace" }} tickFormatter={yFmt} width={52} />
                    {p.commissionStartWeek > 0 && p.commissionStartWeek <= p.weeks && (
                      <ReferenceLine x={p.commissionStartWeek} stroke="rgba(240,160,48,0.6)" strokeWidth={1} strokeDasharray="4 3"
                        label={{ value: "Comm. starts", fill: "#f0a030", fontSize: 9, fontFamily: "ui-monospace,monospace", position: "insideTopLeft" }} />
                    )}
                    {spaghettiKeys.map((key) => (
                      <Line key={key} type="monotone" dataKey={key} stroke="rgba(0,204,122,0.07)" strokeWidth={1} dot={false} isAnimationActive={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── Efficiency + Regime chart ──────────────── */}
          <div>
            <p className="panel-title" style={{ marginBottom: 3 }}>
              Operator Efficiency + Regime Penalty — Median Path
            </p>
            <p className="label-xs" style={{ marginBottom: 8 }}>
              OU(μ={`${(p.operatorMeanEff*100).toFixed(0)}%`}, σ=7.5%, θ=0.35) · Dashed = regime_penalty · MC95 = 12 trades · ×0.95 safety applied
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginBottom: 8 }}>
              {[["≥95%","#00e88c","1.18×"],["80–95%","#00cc7a","1.00×"],["50–80%","#f0a030","0.60×"],["<50%","#f03a57","0.30×"]].map(([l,c,m]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: c, display: "block" }} />
                  <span style={{ fontSize: 9, color: "rgba(142,163,190,0.7)" }}>{l} {m}</span>
                </div>
              ))}
              <span style={{ fontSize: 9, color: "rgba(240,58,87,0.7)", borderLeft: "1px solid rgba(255,255,255,0.08)", paddingLeft: 10 }}>
                ╌ regime_penalty (1.0 = no cut)
              </span>
            </div>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={effData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#00cc7a" stopOpacity={0.20} />
                      <stop offset="95%" stopColor="#00cc7a" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: "rgba(142,163,190,0.7)", fontSize: 10 }} tickFormatter={(v) => `W${v}`} interval={xInterval} />
                  <YAxis domain={[0.35, 1.08]} axisLine={false} tickLine={false} tick={{ fill: "rgba(142,163,190,0.7)", fontSize: 10 }} tickFormatter={(v) => `${(v*100).toFixed(0)}%`} />
                  <Tooltip content={<EffTip />} cursor={{ stroke: "rgba(255,255,255,0.10)", strokeWidth: 1 }} />
                  <ReferenceLine y={0.95} stroke="#00e88c" strokeWidth={1} strokeDasharray="3 3" label={{ value: "Exc.", fill: "#00e88c", fontSize: 8, position: "insideTopRight" }} />
                  <ReferenceLine y={0.80} stroke="#00cc7a" strokeWidth={1} strokeDasharray="3 3" label={{ value: "Normal", fill: "#00cc7a", fontSize: 8, position: "insideTopRight" }} />
                  <ReferenceLine y={0.50} stroke="#f0a030" strokeWidth={1} strokeDasharray="3 3" label={{ value: "Red.", fill: "#f0a030", fontSize: 8, position: "insideTopRight" }} />
                  <ReferenceLine y={0.40} stroke="#f03a57" strokeWidth={1} strokeDasharray="3 3" label={{ value: "Halt", fill: "#f03a57", fontSize: 8, position: "insideTopRight" }} />
                  <Area type="monotone" dataKey="eff"    stroke="#00cc7a" strokeWidth={1.5} fill="url(#eg)" dot={false} isAnimationActive={false} />
                  <Area type="stepAfter" dataKey="regime" stroke="rgba(240,58,87,0.65)" strokeWidth={1.5} fill="none" dot={false} isAnimationActive={false} strokeDasharray="3 2" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Terminal distribution histogram — authed ── */}
          {authed && histData.length > 0 && (
            <div>
              <p className="panel-title" style={{ marginBottom: 3 }}>Terminal Wealth Distribution</p>
              <p className="label-xs" style={{ marginBottom: 10 }}>
                Frequency of final equity multiples across 200 sampled paths · Green bar = median bucket
              </p>
              <div style={{ height: 140 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histData} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "rgba(142,163,190,0.6)", fontSize: 7.5, fontFamily: "ui-monospace,monospace" }} axisLine={false} tickLine={false} interval={2} />
                    <YAxis tick={{ fill: "rgba(142,163,190,0.6)", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<HistTip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                    <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                      {histData.map((entry, i) => (
                        <Cell key={i} fill={entry.isMedian ? "#00cc7a" : "rgba(0,204,122,0.22)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── DD distribution — authed ─────────────── */}
          {authed && ddHistData.length > 0 && (
            <div>
              <p className="panel-title" style={{ marginBottom: 3 }}>Max Drawdown Distribution</p>
              <p className="label-xs" style={{ marginBottom: 10 }}>
                Per-path peak-to-trough DD across 200 sampled paths · Red bar = mean DD
              </p>
              <div style={{ height: 130 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ddHistData} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "rgba(142,163,190,0.6)", fontSize: 7.5, fontFamily: "ui-monospace,monospace" }} axisLine={false} tickLine={false} interval={1} />
                    <YAxis tick={{ fill: "rgba(142,163,190,0.6)", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<DDHistTip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                    <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                      {ddHistData.map((entry, i) => (
                        <Cell key={i} fill={entry.isMean ? "#f03a57" : "rgba(240,58,87,0.25)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Year-by-year milestones — authed ──────── */}
          {authed && yearData.length > 0 && (
            <div>
              <p className="panel-title" style={{ marginBottom: 8 }}>Year-End Milestones — P5 / Median / P95</p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr>
                      {["Year", "P5 — Bear", "P50 — Median", "P95 — Bull"].map((h, i) => (
                        <th key={h} className="mono" style={{ padding: "7px 12px", textAlign: i === 0 ? "left" : "right", fontSize: 9, letterSpacing: "0.10em", color: "var(--ink-2)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {yearData.map(({ year, p5, p50, p95 }) => (
                      <tr key={year} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td className="mono" style={{ padding: "8px 12px", color: "var(--ink-2)" }}>Yr {year}</td>
                        <td className="mono" style={{ padding: "8px 12px", color: "#f03a57", textAlign: "right" }}>{formatMultiple(p5)}×</td>
                        <td className="mono" style={{ padding: "8px 12px", color: "#00cc7a", textAlign: "right", fontWeight: 700 }}>{formatMultiple(p50)}×</td>
                        <td className="mono" style={{ padding: "8px 12px", color: "#4d9cf5", textAlign: "right" }}>{formatMultiple(p95)}×</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Efficiency tier bar ────────────────────── */}
          {res && (
            <div>
              <p className="label-xs" style={{ marginBottom: 8 }}>
                Operator tier distribution — 1,000 paths × {p.weeks} weeks
              </p>
              <div style={{ display: "flex", gap: 2, height: 16, borderRadius: 3, overflow: "hidden" }}>
                {[
                  { pct: res.effStats.pctExcellence, c: "#00e88c" },
                  { pct: res.effStats.pctNormal,     c: "#00cc7a" },
                  { pct: res.effStats.pctReduced,    c: "#f0a030" },
                  { pct: res.effStats.pctCritical,   c: "#f03a57" },
                  { pct: res.effStats.pctHalted,     c: "#5a0e1a" },
                ].map(({ pct, c }, i) => pct > 0.3 && (
                  <div key={i} title={`${pct.toFixed(1)}%`} style={{ background: c, width: `${pct}%`, opacity: 0.85 }} />
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 5 }}>
                {[
                  ["Excellence ≥95%", res.effStats.pctExcellence, "#00e88c"],
                  ["Normal 80–95%",   res.effStats.pctNormal,     "#00cc7a"],
                  ["Reduced 50–80%",  res.effStats.pctReduced,    "#f0a030"],
                  ["Crit/Halt <50%",  res.effStats.pctCritical+res.effStats.pctHalted, "#f03a57"],
                  ["Regime cuts",     res.regimeStats.pctHaircut+res.regimeStats.pctToxic, "#c0392b"],
                ].map(([label, pct, c]) => (
                  <div key={label as string} style={{ display: "flex", gap: 5, alignItems: "center" }}>
                    <span style={{ width: 6, height: 6, borderRadius: 1, background: c as string }} />
                    <span style={{ fontSize: 9, color: "rgba(142,163,190,0.75)" }}>{label}</span>
                    <span className="mono" style={{ fontSize: 9, fontWeight: 700, color: c as string }}>{(pct as number).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Result stats grid ─────────────────────── */}
          {res && (
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))" }}>
              <StatCard label="Median"    value={`${formatMultiple(res.medianTerminal)}×`} accent="#00cc7a" />
              <StatCard label="P5"        value={`${formatMultiple(res.p5Terminal)}×`}     accent="#4d9cf5" />
              <StatCard label="P95"       value={`${formatMultiple(res.p95Terminal)}×`}    accent="#00cc7a" />
              <StatCard label="Ruin Rate" value={`${res.pctRuined.toFixed(1)}%`}           accent={res.pctRuined > 5 ? "#f03a57" : "#00cc7a"} />
              {authed && <>
                <StatCard label="Mean Terminal"    value={`${formatMultiple(res.meanTerminal)}×`}           accent="#00cc7a" />
                <StatCard label="Worst Path"       value={`${formatMultiple(res.worstTerminal)}×`}           accent="#f03a57" />
                <StatCard label="Avg Max DD"       value={`−${(res.meanMaxDD*100).toFixed(1)}%`}             accent="#f03a57" />
                <StatCard label="Worst DD"         value={`−${(res.worstMaxDD*100).toFixed(1)}%`}            accent="#f03a57" />
                <StatCard label="Mean Eff"         value={`${(res.meanMeanEff*100).toFixed(1)}%`}            accent="#f0a030" sub="avg operator eff" />
                <StatCard label="Avg Regime"       value={`${res.meanRegimePenalty.toFixed(3)}×`}            accent={res.meanRegimePenalty < 0.98 ? "#f03a57" : "#8ea3be"} sub="streak penalty" />
                <StatCard label="Total Comm. Paid" value={res.meanTotalComm > 0 ? `${(res.meanTotalComm * 100).toFixed(2)}%` : "—"} accent="#f0a030" sub="of initial capital" />
                <StatCard label="Avg Comm. / Week" value={res.meanAvgCommPerWeek > 0 ? `${(res.meanAvgCommPerWeek * 100).toFixed(4)}%` : "—"} accent="#f0a030" sub="fraction per week" />
                <StatCard label="Avg Injection"    value={res.meanTotalInj > 0 ? `${(res.meanTotalInj*100).toFixed(1)}%` : "—"} accent="#00cc7a" sub="of initial (received)" />
                <StatCard label="Inject Events"    value={res.meanInjEvents > 0 ? res.meanInjEvents.toFixed(1) : "—"} accent="#00cc7a" sub="qualifying 4-wk periods" />
              </>}
              {authed && analystMetrics && <>
                <StatCard label="Calmar Ratio"    value={analystMetrics.calmar >= 99 ? "∞" : analystMetrics.calmar.toFixed(2)} accent={analystMetrics.calmar > 1.5 ? "#00cc7a" : analystMetrics.calmar > 0.8 ? "#f0a030" : "#f03a57"} sub="CAGR / mean max DD" />
                <StatCard label="P50 CAGR"        value={`${(analystMetrics.annualCAGR * 100).toFixed(1)}%`} accent="#00cc7a" sub="annualised median" />
                <StatCard label="Edge Half-Life"  value={analystMetrics.edgeHalfLifeQtr === Infinity ? "stable" : `${analystMetrics.edgeHalfLifeQtr.toFixed(0)} qtrs`} accent={analystMetrics.edgeHalfLifeQtr < 20 ? "#f03a57" : analystMetrics.edgeHalfLifeQtr < 40 ? "#f0a030" : "#8ea3be"} sub="qtrs to halve expectancy" />
              </>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
