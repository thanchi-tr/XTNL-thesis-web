"use client";

import { useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, AreaChart, Area,
  BarChart, Bar, Cell,
} from "recharts";
import { formatMultiple, type SimParams, type ScalingCondition } from "@/lib/simulation";
import SliderControl from "@/components/ui/SliderControl";
import ScalingRulesEditor from "@/components/simulator/ScalingRulesEditor";
import { useSimulator } from "@/context/SimulatorContext";

/* ─── Presets ──────────────────────────────────────────────────── */
const PRESETS = [
  { label: "Baseline",    p: { operatorMeanEff: 0.82, edgeDecayPctPerQtr: 3,   baseRiskPct: 0.70 } },
  { label: "Pessimistic", p: { operatorMeanEff: 0.70, edgeDecayPctPerQtr: 6,   baseRiskPct: 0.50 } },
  { label: "Optimistic",  p: { operatorMeanEff: 0.92, edgeDecayPctPerQtr: 1.5, baseRiskPct: 0.85 } },
];

/* ─── Helpers ──────────────────────────────────────────────────── */
const fmtEq = (v: number) =>
  v >= 1e6  ? `${(v/1e6).toFixed(1)}M×`
  : v >= 1000 ? `${(v/1000).toFixed(0)}K×`
  : `${v.toFixed(2)}×`;

/* ─── Sub-components ───────────────────────────────────────────── */
function ImpactBadge({ level }: { level: "critical" | "high" | "medium" }) {
  const cfg = {
    critical: { bg: "rgba(240,58,87,0.10)",  border: "rgba(240,58,87,0.28)",  color: "#f03a57", label: "CRITICAL" },
    high:     { bg: "rgba(240,160,48,0.10)", border: "rgba(240,160,48,0.28)", color: "#f0a030", label: "HIGH"     },
    medium:   { bg: "rgba(77,156,245,0.08)", border: "rgba(77,156,245,0.22)", color: "#4d9cf5", label: "MEDIUM"   },
  }[level];
  return (
    <span style={{
      fontSize: 7, padding: "1px 5px", borderRadius: 2, fontFamily: "var(--font-mono)",
      fontWeight: 800, letterSpacing: "0.08em",
      background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color,
    }}>{cfg.label}</span>
  );
}

function SectionHead({ title, sub, accent = "rgba(0,204,122,0.65)" }: {
  title: string; sub?: string; accent?: string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: sub ? 3 : 0 }}>
        <span style={{ width: 2, height: 10, borderRadius: 1, background: accent, flexShrink: 0 }} />
        <p className="label-xs" style={{ color: "var(--ink-1)" }}>{title}</p>
      </div>
      {sub && <p style={{ fontSize: 9.5, color: "rgba(142,163,190,0.38)", lineHeight: 1.5, paddingLeft: 9 }}>{sub}</p>}
    </div>
  );
}

function InfoBadge({ label, value, color = "rgba(0,204,122,0.75)" }: {
  label: string; value: string; color?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0" }}>
      <span style={{ fontSize: 9.5, color: "rgba(142,163,190,0.60)" }}>{label}</span>
      <span className="mono" style={{ fontSize: 9.5, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

function Kpi({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ minWidth: 52, display: "flex", flexDirection: "column", gap: 2 }}>
      <span className="label-xs" style={{ fontSize: 8.5, letterSpacing: "0.08em" }}>{label}</span>
      <span className="mono" style={{ fontSize: 19, fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontSize: 7.5, color: "rgba(142,163,190,0.38)", fontFamily: "var(--font-mono)" }}>{sub}</span>}
    </div>
  );
}

function StatCard({ label, value, accent = "#00cc7a", sub }: {
  label: string; value: string; accent?: string; sub?: string;
}) {
  return (
    <div className="card" style={{ padding: "10px 10px", minWidth: 0 }}>
      <span className="label-xs" style={{ display: "block", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 8.5 }}>
        {label}
      </span>
      <span className="mono" style={{ fontSize: 15, fontWeight: 800, color: accent, lineHeight: 1, display: "block" }}>
        {value}
      </span>
      {sub && <span style={{ fontSize: 7.5, color: "rgba(142,163,190,0.5)", marginTop: 2, display: "block" }}>{sub}</span>}
    </div>
  );
}

/* ─── Chart tooltips ───────────────────────────────────────────── */
function FanTip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: number }) {
  if (!active || !payload?.length) return null;
  const get = (k: string) => payload.find(p => p.dataKey === k)?.value;
  const rows: [string, number | undefined, string][] = [
    ["P95", get("p95"), "#4d9cf5"], ["P75", get("p75"), "rgba(0,204,122,0.8)"],
    ["P50 Median", get("p50"), "#00cc7a"], ["P25", get("p25"), "rgba(240,160,48,0.8)"],
    ["P5", get("p5"), "#f03a57"],
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
  const c   = eff >= 0.95 ? "#00e88c" : eff >= 0.80 ? "#00cc7a" : eff >= 0.50 ? "#f0a030" : "#f03a57";
  return (
    <div style={{ background: "#07101c", border: `1px solid ${c}35`, borderRadius: 6, padding: "12px 14px", fontFamily: "ui-monospace,monospace", boxShadow: "0 12px 40px rgba(0,0,0,0.8)", minWidth: 160 }}>
      <p style={{ fontSize: 10, color: "rgba(142,163,190,0.65)", marginBottom: 8 }}>Week {label}</p>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 5 }}>
        <span style={{ fontSize: 10, color: "rgba(142,163,190,0.65)" }}>Efficiency</span>
        <span className="mono" style={{ fontSize: 13, color: c, fontWeight: 800 }}>{(eff*100).toFixed(1)}%</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <span style={{ fontSize: 10, color: "rgba(142,163,190,0.65)" }}>Regime Penalty</span>
        <span className="mono" style={{ fontSize: 13, color: reg < 1 ? "#f03a57" : "#8ea3be", fontWeight: 700 }}>{reg.toFixed(2)}×</span>
      </div>
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

/* ═══════════════════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════════════════ */
export default function MonteCarloSimulator() {
  const { params: p, result: res, running, setParam, setParams, rerun } = useSimulator();
  const { data: session } = useSession();

  /* In dev: bypass RBAC so simulator is always fully functional.
     In production builds, isDev compiles to false (dead code).  */
  const isDev  = process.env.NODE_ENV === "development";
  const authed = isDev || Boolean(
    (session as any)?.roles?.some((r: string) => ["strategist", "fund_manager"].includes(r))
  );

  const [activeTab, setActiveTab] = useState<"governor" | "market">("governor");

  /* ── Spaghetti chart (public / unauthenticated) ────────────── */
  const { spaghettiData, spaghettiKeys } = useMemo(() => {
    if (!res || authed) return { spaghettiData: [], spaghettiKeys: [] };
    const MAX  = 40;
    const ws   = Math.max(1, Math.floor(p.weeks / 65));
    const ps   = Math.max(1, Math.floor(res.paths.length / MAX));
    const samp = res.paths.filter((_, i) => i % ps === 0).slice(0, MAX);
    const keys = samp.map((_, i) => `p${i}`);
    const data: Record<string, number>[] = [];
    for (let w = 0; w < p.weeks; w += ws) {
      const pt: Record<string, number> = { week: w + 1 };
      samp.forEach((path, i) => { if (path[w] !== undefined) pt[keys[i]] = path[w]; });
      data.push(pt);
    }
    return { spaghettiData: data, spaghettiKeys: keys };
  }, [res, p.weeks, authed]);

  const buildEffData = useCallback((effS: number[][], regS: number[][], wks: number) => {
    const me = effS[Math.floor(effS.length / 2)] ?? effS[0];
    const mr = regS[Math.floor(regS.length / 2)] ?? regS[0];
    return Array.from({ length: wks }, (_, w) => ({ week: w + 1, eff: me[w] ?? 0.82, regime: mr[w] ?? 1.0 }));
  }, []);

  const fanData = useMemo(() => {
    if (!res || !authed) return [];
    return Array.from({ length: p.weeks }, (_, w) => {
      const vals = res.paths.map(path => Math.max(0.01, path[w] ?? 1)).sort((a, b) => a - b);
      const n = vals.length;
      const q = (t: number) => vals[Math.min(Math.floor(n * t), n - 1)] ?? 1;
      return { week: w + 1, p5: q(0.05), p25: q(0.25), p50: q(0.50), p75: q(0.75), p95: q(0.95) };
    });
  }, [res, p.weeks, authed]);

  const histData = useMemo(() => {
    if (!res || !authed) return [];
    const BINS = 18;
    const vals   = res.paths.map(path => Math.max(0.01, path[p.weeks - 1] ?? 1));
    const sorted = [...vals].sort((a, b) => a - b);
    const lo = sorted[0], hi = sorted[sorted.length - 1], range = (hi - lo) || 1;
    const bins = Array.from({ length: BINS }, (_, i) => ({ label: fmtEq(lo + (i + 0.5) * (range / BINS)), count: 0, isMedian: false }));
    for (const v of vals) { const idx = Math.min(Math.floor(((v - lo) / range) * BINS), BINS - 1); bins[idx].count++; }
    const mi = Math.min(Math.floor(((res.medianTerminal - lo) / range) * BINS), BINS - 1);
    if (bins[mi]) bins[mi].isMedian = true;
    return bins;
  }, [res, p.weeks, authed]);

  const yearData = useMemo(() => {
    if (!fanData.length) return [];
    return Array.from({ length: Math.min(Math.floor(p.weeks / 52), 10) }, (_, i) => {
      const d = fanData[(i + 1) * 52 - 1];
      return d ? { year: i + 1, p5: d.p5, p50: d.p50, p95: d.p95 } : null;
    }).filter(Boolean) as { year: number; p5: number; p50: number; p95: number }[];
  }, [fanData, p.weeks]);

  const analystMetrics = useMemo(() => {
    if (!res || !authed || !fanData.length) return null;
    const yrs        = p.weeks / 52;
    const annualCAGR = Math.pow(Math.max(0.001, res.medianTerminal), 1 / yrs) - 1;
    const calmar     = res.meanMaxDD > 0 ? annualCAGR / res.meanMaxDD : 99;
    const edgeHL     = p.edgeDecayPctPerQtr > 0.01
      ? Math.log(0.5) / Math.log(1 - p.edgeDecayPctPerQtr / 100) : Infinity;
    const m2  = fanData.findIndex(d => d.p50 >= 2);
    const m5  = fanData.findIndex(d => d.p50 >= 5);
    const m10 = fanData.findIndex(d => d.p50 >= 10);
    const constraint =
      p.edgeDecayPctPerQtr > 5                                          ? "EDGE DECAY"       :
      res.effStats.pctCritical + res.effStats.pctHalted > 15            ? "OPERATOR EFF"     :
      res.regimeStats.pctHaircut + res.regimeStats.pctToxic > 20        ? "REGIME CLUSTER"   :
      res.pctRuined > 10                                                 ? "RUIN PROBABILITY" : null;
    const constraintFix =
      constraint === "EDGE DECAY"       ? "Reduce edgeDecayPctPerQtr below 5%, or shorten the horizon" :
      constraint === "OPERATOR EFF"     ? "Raise operatorMeanEff or tighten the DD halt threshold"      :
      constraint === "REGIME CLUSTER"   ? "Lower baseRiskPct or add a scaling rule for low-efficiency"  :
      constraint === "RUIN PROBABILITY" ? "Tighten DD halt or reduce baseRiskPct immediately"           : "";
    const verdict =
      res.pctRuined > 20   ? "UNVIABLE"      :
      res.pctRuined > 10   ? "HIGH RISK"     :
      calmar < 0.5         ? "WEAK RISK-ADJ" :
      calmar > 1.5 && res.pctRuined < 5 ? "VIABLE" : "MARGINAL";
    const vc =
      verdict === "VIABLE"    ? "#00cc7a" :
      verdict === "UNVIABLE"  ? "#f03a57" :
      verdict === "HIGH RISK" ? "#f03a57" : "#f0a030";
    const action =
      verdict === "VIABLE"        ? "Configuration within operating bounds — proceed to forward testing."       :
      verdict === "HIGH RISK"     ? "Reduce baseRiskPct or tighten DD halt before any live deployment."          :
      verdict === "UNVIABLE"      ? "Parameters fundamentally misaligned — do not deploy in current form."      :
      verdict === "WEAK RISK-ADJ" ? "Calmar below threshold — improve expectancy or reduce commission drag."     :
                                    "Borderline profile — stress-test edge decay sensitivity before deploying.";
    return { annualCAGR, calmar, edgeHL, m2, m5, m10, constraint, constraintFix, verdict, vc, action };
  }, [res, authed, fanData, p]);

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
    const lo = Math.max(0, sorted[0] ?? 0), hi = sorted[sorted.length - 1] ?? 100;
    const range = Math.max(1, hi - lo);
    const bins = Array.from({ length: BINS }, (_, i) => ({ label: `${(lo + (i + 0.5) * range / BINS).toFixed(0)}%`, count: 0, isMean: false }));
    for (const dd of dds) { const idx = Math.min(Math.floor(((dd - lo) / range) * BINS), BINS - 1); if (bins[idx]) bins[idx].count++; }
    const mi = Math.min(Math.floor(((res.meanMaxDD * 100 - lo) / range) * BINS), BINS - 1);
    if (bins[mi]) bins[mi].isMean = true;
    return bins;
  }, [res, authed]);

  const effData = useMemo(
    () => res ? buildEffData(res.effPathSamples, res.regPathSamples, p.weeks) : [],
    [res, p.weeks, buildEffData]
  );

  const update      = useCallback((key: keyof SimParams, val: number) => setParam(key, val), [setParam]);
  const applyPreset = (preset: Partial<SimParams>) => setParams({ ...p, ...preset });
  const yFmt        = (v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}K×` : `${v.toFixed(1)}×`;
  const liveEff      = p.operatorMeanEff;
  const liveReg      = res?.meanRegimePenalty ?? 1.0;
  const livePM       = liveEff < 0.40 ? 0 : liveEff < 0.50 ? 0.30 : liveEff < 0.80 ? 0.60 : liveEff >= 0.95 ? 1.18 : 1.0;
  const liveR        = (p.baseRiskPct * livePM * liveReg * 0.95).toFixed(3);
  const xi           = Math.floor(p.weeks / 8);

  const tabBtn = (active: boolean, color: string): React.CSSProperties => ({
    flex: 1, padding: "9px 0 8px", fontSize: 10, fontWeight: active ? 800 : 500,
    letterSpacing: "0.10em", fontFamily: "var(--font-mono)",
    background: active ? `${color}08` : "none", border: "none",
    borderBottom: `2px solid ${active ? color : "rgba(255,255,255,0.06)"}`,
    color: active ? color : "rgba(142,163,190,0.38)",
    cursor: "pointer", transition: "all 0.12s", textTransform: "uppercase" as const,
  });

  /* Wrapper that slots an impact badge above a slider */
  const WithImpact = ({ level, children }: { level: "critical" | "high" | "medium"; children: React.ReactNode }) => (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 2 }}>
        <ImpactBadge level={level} />
      </div>
      {children}
    </div>
  );

  return (
    <>
      <style>{`
        .ws-topbar{display:flex;align-items:center;gap:8px;padding:8px 16px;border-bottom:1px solid rgba(255,255,255,0.06);flex-wrap:wrap}
        .ws-presets{display:flex;gap:5px;align-items:center;flex-wrap:wrap;flex:1;min-width:0}
        .ws-run{margin-left:auto;display:flex;gap:10px;align-items:center}
        .ws-tab-strip{position:sticky;top:0;z-index:3;background:var(--canvas);padding:0 16px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex}
        .ws-panel{padding:16px 16px 24px;display:flex;flex-direction:column;gap:18px}
        .ws-charts{flex:1;min-width:0;display:flex;flex-direction:column}
        .ws-chart-inner{padding:18px 20px;display:flex;flex-direction:column;gap:22px}
        .ws-verdict{padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.22)}
        .ws-formula{padding:7px 20px;border-bottom:1px solid rgba(255,255,255,0.06);background:#060d16;font-family:ui-monospace,monospace;font-size:10.5px;display:flex;align-items:center;gap:4px;flex-wrap:wrap;line-height:1.9}
        .ws-div{height:1px;background:rgba(255,255,255,0.05);margin:2px 0}
        .ws-ib-gov{padding:7px 10px;background:rgba(0,204,122,0.04);border-radius:4px;border:1px solid rgba(0,204,122,0.09);margin-top:8px}
        .ws-ib-mkt{padding:7px 10px;background:rgba(240,160,48,0.04);border-radius:4px;border:1px solid rgba(240,160,48,0.09);margin-top:8px}
        @media (max-width:1099px){.ws-charts{border-top:1px solid rgba(255,255,255,0.06)}}
      `}</style>

      <div className="card" style={{ overflow: "hidden", boxShadow: "var(--shadow-lg)" }}>

        {/* ── Top bar ──────────────────────────────────────────── */}
        <div className="ws-topbar">
          <span className="label-xs" style={{ color: "rgba(142,163,190,0.40)", flexShrink: 0, fontSize: 9 }}>SCENARIO</span>
          <div className="ws-presets">
            {PRESETS.map(({ label, p: preset }) => (
              <button key={label} className="btn btn-ghost"
                style={{ fontSize: 9.5, padding: "4px 11px", letterSpacing: "0.04em" }}
                onClick={() => applyPreset(preset)}>
                {label}
              </button>
            ))}
          </div>
          <div className="ws-run">
            {isDev && (
              <span style={{ fontSize: 8.5, padding: "2px 6px", background: "rgba(240,160,48,0.12)", border: "1px solid rgba(240,160,48,0.28)", borderRadius: 3, color: "#f0a030", fontFamily: "var(--font-mono)", fontWeight: 800, letterSpacing: "0.08em" }}>
                DEV
              </span>
            )}
            {running && <span style={{ fontSize: 9.5, color: "rgba(142,163,190,0.45)", fontFamily: "var(--font-mono)" }}>computing…</span>}
            <button className="btn btn-primary"
              style={{ fontSize: 10, padding: "7px 18px", whiteSpace: "nowrap", fontWeight: 700, letterSpacing: "0.06em" }}
              onClick={rerun} disabled={running}>
              {running ? "Running…" : "Run  ↻"}
            </button>
          </div>
        </div>

        {/* ── Workspace body ────────────────────────────────────── */}
        <div className="sim-body">

          {/* ══ LEFT sidebar ═════════════════════════════════════ */}
          <div className="sim-controls">
            {!authed ? (
              <div style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ margin: 0, fontSize: 11, color: "rgba(142,163,190,0.55)", lineHeight: 1.65 }}>
                  Select a scenario above to explore outcomes. Full strategist workspace requires authentication.
                </p>
                <a href="/api/auth/signin" style={{ fontSize: 10.5, color: "var(--green)", textDecoration: "none" }}>
                  Sign in for full workspace →
                </a>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="ws-tab-strip">
                  <button style={tabBtn(activeTab === "governor", "#00cc7a")} onClick={() => setActiveTab("governor")}>▶ GOVERNOR</button>
                  <button style={tabBtn(activeTab === "market",   "#f0a030")} onClick={() => setActiveTab("market")}>~ MARKET</button>
                </div>

                {/* ── GOVERNOR panel ───────────────────────────── */}
                {activeTab === "governor" && (
                  <div className="ws-panel">
                    <p style={{ fontSize: 9, color: "rgba(0,204,122,0.45)", fontFamily: "var(--font-mono)", letterSpacing: "0.07em", margin: 0 }}>
                      FULL CONTROL — parameters you set
                    </p>

                    {/* Risk Sizing */}
                    <div>
                      <SectionHead title="Risk Sizing" sub="Primary drivers of return distribution shape" />
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <WithImpact level="critical">
                          <SliderControl label="Base Risk θ (% of account)" value={p.baseRiskPct} displayValue={`${p.baseRiskPct.toFixed(2)}%`}
                            min={0.1} max={2.0} step={0.01} tooltip="CVaR-derived position size per 1R trade. Live system: 0.70%."
                            onChange={(v) => update("baseRiskPct", v)} readOnly={!authed} />
                        </WithImpact>
                        <WithImpact level="high">
                          <SliderControl label="DD Halt threshold" value={p.maxDDLimit} displayValue={p.maxDDLimit === 0 ? "Off" : `-${p.maxDDLimit}%`}
                            min={0} max={60} step={5} tooltip="Halt a path when drawdown exceeds this level from peak."
                            onChange={(v) => update("maxDDLimit", v)} readOnly={!authed} />
                        </WithImpact>
                      </div>
                    </div>

                    <div className="ws-div" />

                    {/* Incentive Structure */}
                    <div>
                      <SectionHead title="Incentive Structure" sub="Weekly fees deducted after commission · off by default" />
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <WithImpact level="medium">
                          <SliderControl label="Fixed Rate (% of weekly R)" value={p.fixedRatePct} displayValue={p.fixedRatePct === 0 ? "Off" : `${p.fixedRatePct.toFixed(1)}%`}
                            min={0} max={50} step={0.5} tooltip="Operator receives this % of weekly recommend_r as a fixed fee."
                            onChange={(v) => update("fixedRatePct", v)} readOnly={!authed} />
                        </WithImpact>
                        <WithImpact level="medium">
                          <SliderControl label="Bonus Rate (% of income)" value={p.bonusRatePct} displayValue={p.bonusRatePct === 0 ? "Off" : `${p.bonusRatePct.toFixed(1)}%`}
                            min={0} max={30} step={0.5} tooltip="Bonus paid as % of gross captured income when capture rate meets threshold."
                            onChange={(v) => update("bonusRatePct", v)} readOnly={!authed} />
                        </WithImpact>
                        {p.bonusRatePct > 0 && (
                          <SliderControl label="Bonus Threshold (capture rate ≥)" value={p.bonusThreshold} displayValue={`${(p.bonusThreshold * 100).toFixed(0)}%`}
                            min={0.50} max={1.00} step={0.01} tooltip="Minimum actual capture rate required to trigger the bonus."
                            onChange={(v) => update("bonusThreshold", v)} readOnly={!authed} />
                        )}
                      </div>
                    </div>

                    <div className="ws-div" />

                    {/* Scaling Conditions */}
                    <div>
                      <SectionHead title="Scaling Conditions" sub="Rules stack multiplicatively · empty = standard formula" />
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                        {[["efficiency", "#00cc7a", "OU eff%"], ["captureRate", "#4d9cf5", "eff × adj"]].map(([k, c, v]) => (
                          <div key={k} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <span style={{ width: 6, height: 6, borderRadius: 1, background: c }} />
                            <span style={{ fontSize: 8.5, color: "rgba(142,163,190,0.60)", fontFamily: "var(--font-mono)" }}>{k} = {v}</span>
                          </div>
                        ))}
                      </div>
                      <ScalingRulesEditor
                        conditions={p.scalingConditions}
                        onChange={(conds: ScalingCondition[]) => setParam("scalingConditions", conds)}
                        readOnly={!authed}
                      />
                    </div>

                    <div className="ws-div" />

                    {/* Capital & Timeline */}
                    <div>
                      <SectionHead title="Capital & Timeline" />
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <SliderControl label="Commission Starts (week)" value={p.commissionStartWeek} displayValue={`W${p.commissionStartWeek} (Yr ${Math.ceil(p.commissionStartWeek / 52)})`}
                          min={0} max={260} step={4} tooltip="Weeks before commission payments begin."
                          onChange={(v) => update("commissionStartWeek", v)} readOnly={!authed} />
                        <SliderControl label="Frozen Pool (% of initial cap)" value={p.frozenPoolPct} displayValue={p.frozenPoolPct === 0 ? "Off" : `${(p.frozenPoolPct * 100).toFixed(0)}% / period`}
                          min={0} max={1.0} step={0.05} tooltip="Capital injected each qualifying 4-week period (ALL 4 weeks eff > 85%)."
                          onChange={(v) => update("frozenPoolPct", v)} readOnly={!authed} />
                        <SliderControl label="Tax Rate (ATO annual)" value={p.taxRatePct} displayValue={`${p.taxRatePct.toFixed(0)}%`}
                          min={0} max={47} step={1} tooltip="Applied to realised gains at year-end. 47% = ATO top marginal + 2% Medicare."
                          onChange={(v) => update("taxRatePct", v)} readOnly={!authed} />
                        <SliderControl label="Horizon (weeks)" value={p.weeks} displayValue={`${p.weeks}w · ${Math.round(p.weeks / 52)}yr`}
                          min={52} max={520} step={1} tooltip="Total simulation duration."
                          onChange={(v) => update("weeks", v)} readOnly={!authed} />
                      </div>
                      {p.frozenPoolPct > 0 && (
                        <div className="ws-ib-gov">
                          <InfoBadge label="Gate (ALL 4 weeks)" value="eff > 85%" />
                          <InfoBadge label="Excellence scale"   value="1.20× (eff > 95%)" />
                          <InfoBadge label="Failure reset"      value="Pool → 0, streak = 0" />
                        </div>
                      )}
                    </div>

                    <div className="ws-div" />

                    {/* Commission reference */}
                    <div>
                      <SectionHead title="Commission Formula" sub="Live system · commission_generator.py" />
                      <div className="ws-ib-gov">
                        <InfoBadge label="Base rate"        value="20% of recommend_r" />
                        <InfoBadge label="Profit bonus"     value="5% of realised_r (pos weeks)" />
                        <InfoBadge label="Excellence mult." value="1.5× when eff ≥ 95%" />
                        <InfoBadge label="Gate"             value="eff ≥ 88% · else zero" />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── MARKET panel ─────────────────────────────── */}
                {activeTab === "market" && (
                  <div className="ws-panel">
                    <p style={{ fontSize: 9, color: "rgba(240,160,48,0.50)", fontFamily: "var(--font-mono)", letterSpacing: "0.07em", margin: 0 }}>
                      ESTIMATES — parameters you can only model
                    </p>

                    {/* Edge Parameters */}
                    <div>
                      <SectionHead title="Edge Parameters" accent="rgba(240,160,48,0.65)"
                        sub="Individual trades simulated · MC95 losing streak = 12" />
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <WithImpact level="critical">
                          <SliderControl label="Expectancy μ (R per trade)" value={p.expPerTrade} displayValue={`${p.expPerTrade.toFixed(3)} R`}
                            min={0.1} max={2.0} step={0.01} tooltip="Mean R-multiple per trade. Erodes quarterly by edge decay. Live: 0.982 R."
                            onChange={(v) => update("expPerTrade", v)} readOnly={!authed} />
                        </WithImpact>
                        <WithImpact level="high">
                          <SliderControl label="Edge Decay (% per quarter)" value={p.edgeDecayPctPerQtr} displayValue={`${p.edgeDecayPctPerQtr.toFixed(1)}%`}
                            min={0} max={15} step={0.5} tooltip="Expectancy erodes every 13 weeks as the market adapts."
                            onChange={(v) => update("edgeDecayPctPerQtr", v)} readOnly={!authed} />
                        </WithImpact>
                        <SliderControl label="Trades / Week" value={p.tradesPerWeek} displayValue={`${p.tradesPerWeek}`}
                          min={1} max={25} step={1} tooltip="Validated entries per week. Each trade simulated individually."
                          onChange={(v) => update("tradesPerWeek", v)} readOnly={!authed} />
                        <SliderControl label="Volatility σ (R per trade)" value={p.volPerTrade} displayValue={`${p.volPerTrade.toFixed(1)} R`}
                          min={0.5} max={10} step={0.1} tooltip="Per-trade R std deviation. Higher = wider distribution."
                          onChange={(v) => update("volPerTrade", v)} readOnly={!authed} />
                      </div>
                    </div>

                    <div className="ws-div" />

                    {/* Operator Model */}
                    <div>
                      <SectionHead title="Operator (OU Process)" accent="rgba(240,160,48,0.65)"
                        sub="Mean-reverting · θ=0.35, σ=7.5% · shocks persist ~3 weeks" />
                      <WithImpact level="high">
                        <SliderControl label="Mean Efficiency μ_eff" value={p.operatorMeanEff} displayValue={`${(p.operatorMeanEff * 100).toFixed(0)}%`}
                          min={0.60} max={0.98} step={0.01} tooltip="Long-run mean the OU process reverts toward. Live: 82.2%."
                          onChange={(v) => update("operatorMeanEff", v)} readOnly={!authed} />
                      </WithImpact>
                      <div className="ws-ib-mkt">
                        <InfoBadge label="Reversion speed (θ)" value="0.35"        color="rgba(240,160,48,0.7)" />
                        <InfoBadge label="Weekly volatility (σ)" value="7.5%"       color="rgba(240,160,48,0.7)" />
                        <InfoBadge label="Hard floor"            value="40%"        color="rgba(240,160,48,0.7)" />
                        <InfoBadge label="Slippage (pos weeks)"  value="0.10–0.20 R" color="rgba(240,160,48,0.7)" />
                      </div>
                    </div>

                    <div className="ws-div" />

                    {/* Attributed Randomness */}
                    <div>
                      <SectionHead title="Attributed Randomness" accent="rgba(240,160,48,0.65)"
                        sub="Model variability beyond the OU process · all off by default" />
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <SliderControl label="Efficiency Extra Noise (σ)" value={p.efficiencyStdDev}
                          displayValue={p.efficiencyStdDev === 0 ? "Off" : `±${(p.efficiencyStdDev * 100).toFixed(1)}%`}
                          min={0} max={0.12} step={0.005} tooltip="Extra weekly noise added to the OU step on top of base σ=7.5%."
                          onChange={(v) => update("efficiencyStdDev", v)} readOnly={!authed} />
                        <SliderControl label="Capture Rate Mean (× eff)" value={p.captureRateMean}
                          displayValue={`${(p.captureRateMean * 100).toFixed(0)}%`}
                          min={0.50} max={1.50} step={0.01} tooltip="Mean multiplier on captured R. 100% = standard model."
                          onChange={(v) => update("captureRateMean", v)} readOnly={!authed} />
                        <SliderControl label="Capture Rate Noise (σ)" value={p.captureRateStdDev}
                          displayValue={p.captureRateStdDev === 0 ? "Off" : `±${(p.captureRateStdDev * 100).toFixed(1)}%`}
                          min={0} max={0.30} step={0.01} tooltip="Week-to-week randomness in capture rate multiplier."
                          onChange={(v) => update("captureRateStdDev", v)} readOnly={!authed} />
                        <SliderControl label="Trade Frequency Noise (σ)" value={p.tradeFreqStdDev}
                          displayValue={p.tradeFreqStdDev === 0 ? "Off" : `±${p.tradeFreqStdDev.toFixed(1)} trades`}
                          min={0} max={5} step={0.5} tooltip="Std dev of weekly trade count around tradesPerWeek."
                          onChange={(v) => update("tradeFreqStdDev", v)} readOnly={!authed} />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ══ RIGHT: Decision intelligence + Charts ════════════ */}
          <div className="ws-charts">

            {/* ── Decision Banner ─────────────────────────────────
                Action-first: verdict → KPIs → next action → binding constraint → milestones */}
            {authed && analystMetrics && res && (
              <div className="ws-verdict" style={{ borderLeft: `4px solid ${analystMetrics.vc}` }}>

                {/* Status line */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: analystMetrics.vc, flexShrink: 0, boxShadow: `0 0 8px ${analystMetrics.vc}80` }} />
                  <span className="mono" style={{ fontSize: 22, fontWeight: 800, letterSpacing: "0.06em", color: analystMetrics.vc, lineHeight: 1 }}>
                    {analystMetrics.verdict}
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 8.5, color: "rgba(142,163,190,0.35)", fontFamily: "var(--font-mono)" }}>
                    1 000 PATHS · {p.weeks}W
                  </span>
                </div>

                {/* KPI strip */}
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 14 }}>
                  {([
                    ["P50 CAGR",  `${(analystMetrics.annualCAGR * 100).toFixed(1)}%`,  analystMetrics.annualCAGR > 0.2 ? "#00cc7a" : "#f0a030", "annualised"],
                    ["CALMAR",    analystMetrics.calmar >= 99 ? "∞" : analystMetrics.calmar.toFixed(2), analystMetrics.calmar > 1.5 ? "#00cc7a" : analystMetrics.calmar > 0.8 ? "#f0a030" : "#f03a57", "return÷DD"],
                    ["RUIN",      `${res.pctRuined.toFixed(1)}%`,  res.pctRuined > 10 ? "#f03a57" : res.pctRuined > 5 ? "#f0a030" : "#00cc7a", "paths → 0"],
                    ["MAX DD",    `−${(res.meanMaxDD * 100).toFixed(1)}%`, res.meanMaxDD > 0.4 ? "#f03a57" : res.meanMaxDD > 0.2 ? "#f0a030" : "#00cc7a", "mean worst"],
                    ["EDGE LIFE", analystMetrics.edgeHL === Infinity ? "stable" : `${analystMetrics.edgeHL.toFixed(0)}q`, analystMetrics.edgeHL < 20 ? "#f03a57" : "#8ea3be", "half-life"],
                  ] as [string, string, string, string][]).map(([label, value, color, sub]) => (
                    <Kpi key={label} label={label} value={value} color={color} sub={sub} />
                  ))}
                </div>

                {/* Next action callout */}
                <div style={{ padding: "8px 12px", borderRadius: 4, borderLeft: `3px solid ${analystMetrics.vc}`, background: `${analystMetrics.vc}08`, marginBottom: analystMetrics.constraint ? 10 : 12 }}>
                  <p style={{ fontSize: 8.5, fontFamily: "var(--font-mono)", fontWeight: 800, color: analystMetrics.vc, marginBottom: 4, letterSpacing: "0.07em" }}>
                    ▸ NEXT ACTION
                  </p>
                  <p style={{ fontSize: 11, color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>
                    {analystMetrics.action}
                  </p>
                </div>

                {/* Binding constraint */}
                {analystMetrics.constraint && (
                  <div style={{ display: "flex", gap: 8, padding: "7px 10px", background: "rgba(240,160,48,0.06)", border: "1px solid rgba(240,160,48,0.16)", borderRadius: 4, marginBottom: 12 }}>
                    <span style={{ color: "#f0a030", fontSize: 12, flexShrink: 0, marginTop: 1 }}>⚠</span>
                    <div>
                      <p style={{ fontSize: 8.5, fontFamily: "var(--font-mono)", fontWeight: 800, color: "#f0a030", marginBottom: 3, letterSpacing: "0.07em" }}>
                        BINDING — {analystMetrics.constraint}
                      </p>
                      <p style={{ fontSize: 10.5, color: "rgba(240,160,48,0.75)", lineHeight: 1.55, margin: 0 }}>
                        {analystMetrics.constraintFix}
                      </p>
                    </div>
                  </div>
                )}

                {/* P50 milestones */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                  <span className="label-xs" style={{ fontSize: 8.5, marginRight: 3 }}>P50 REACH</span>
                  {([["2×", analystMetrics.m2], ["5×", analystMetrics.m5], ["10×", analystMetrics.m10]] as [string, number][]).map(([label, wk]) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 9px", background: wk === -1 ? "rgba(255,255,255,0.02)" : "rgba(77,156,245,0.06)", border: `1px solid ${wk === -1 ? "rgba(255,255,255,0.05)" : "rgba(77,156,245,0.14)"}`, borderRadius: 4 }}>
                      <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-1)" }}>{label}</span>
                      <span className="mono" style={{ fontSize: 10, color: wk === -1 ? "rgba(142,163,190,0.28)" : "#4d9cf5" }}>
                        {wk === -1 ? "n/a" : `W${wk + 1} · Yr${((wk + 1) / 52).toFixed(1)}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Risk formula strip ──────────────────────────────── */}
            {authed && (
              <div className="ws-formula">
                <span style={{ color: "rgba(142,163,190,0.45)" }}>applied_risk</span>
                <span style={{ color: "rgba(142,163,190,0.28)" }}>=</span>
                <span style={{ color: "#00cc7a", fontWeight: 700 }}>{p.baseRiskPct.toFixed(2)}%</span>
                <span style={{ color: "rgba(142,163,190,0.28)" }}>×</span>
                <span style={{ color: "rgba(142,163,190,0.45)" }}>perf</span>
                <span style={{ color: "#4d9cf5", fontWeight: 700 }}>{livePM.toFixed(2)}</span>
                <span style={{ color: "rgba(142,163,190,0.28)" }}>×</span>
                <span style={{ color: "rgba(142,163,190,0.45)" }}>regime</span>
                <span style={{ color: liveReg < 1 ? "#f03a57" : "rgba(142,163,190,0.65)", fontWeight: 700 }}>{liveReg.toFixed(3)}</span>
                <span style={{ color: "rgba(142,163,190,0.28)" }}>× 0.95 =</span>
                <span style={{ color: "#00e88c", fontWeight: 800, fontSize: 11.5 }}>{liveR}%</span>
                {p.scalingConditions.length > 0 && (
                  <span style={{ marginLeft: 4, padding: "1px 6px", background: "rgba(192,132,252,0.10)", border: "1px solid rgba(192,132,252,0.20)", borderRadius: 3, fontSize: 9, color: "#c084fc", fontWeight: 700 }}>
                    × scaling ({p.scalingConditions.length})
                  </span>
                )}
                {(p.fixedRatePct > 0 || p.bonusRatePct > 0) && (
                  <span style={{ marginLeft: 4, padding: "1px 6px", background: "rgba(192,132,252,0.10)", border: "1px solid rgba(192,132,252,0.20)", borderRadius: 3, fontSize: 9, color: "#c084fc", fontWeight: 700 }}>
                    + gov fees
                  </span>
                )}
                {(p.captureRateStdDev > 0 || p.captureRateMean !== 1.0) && (
                  <span style={{ marginLeft: 4, padding: "1px 6px", background: "rgba(77,156,245,0.08)", border: "1px solid rgba(77,156,245,0.18)", borderRadius: 3, fontSize: 9, color: "#4d9cf5", fontWeight: 700 }}>
                    captureAdj
                  </span>
                )}
              </div>
            )}

            {/* ── Charts ─────────────────────────────────────────── */}
            <div className="ws-chart-inner">

              {/* Equity fan / spaghetti */}
              <div>
                <div style={{ marginBottom: 8 }}>
                  {authed ? (
                    <>
                      <p className="panel-title">Percentile Fan — 1,000 Paths</p>
                      <p className="label-xs" style={{ marginTop: 2 }}>Log scale · P5/P25/P50/P75/P95 · post-tax · post-commission</p>
                    </>
                  ) : (
                    <>
                      <p className="panel-title">1,000-Iteration Equity Convergence</p>
                      <p className="label-xs" style={{ marginTop: 2 }}>Log scale · post-commission · post-tax · OU operator + regime-gated risk</p>
                    </>
                  )}
                </div>

                {authed && fanData.length > 0 && (
                  <>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 14px", marginBottom: 8 }}>
                      {[["P95 Bull","#4d9cf5"],["P75","rgba(0,204,122,0.7)"],["P50 Median","#00cc7a"],["P25","rgba(240,160,48,0.7)"],["P5 Bear","#f03a57"]].map(([l,c]) => (
                        <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ width: 18, height: 1.5, background: c, display: "block", borderRadius: 1 }} />
                          <span style={{ fontSize: 8.5, color: "rgba(142,163,190,0.65)" }}>{l}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={fanData}>
                          <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: "rgba(142,163,190,0.65)", fontSize: 9.5, fontFamily: "ui-monospace,monospace" }} tickFormatter={(v) => `W${v}`} interval={xi} />
                          <YAxis scale="log" domain={["auto","auto"]} axisLine={false} tickLine={false} tick={{ fill: "rgba(142,163,190,0.65)", fontSize: 9.5, fontFamily: "ui-monospace,monospace" }} tickFormatter={yFmt} width={50} />
                          <Tooltip content={<FanTip />} cursor={{ stroke: "rgba(255,255,255,0.10)", strokeWidth: 1 }} />
                          {p.commissionStartWeek > 0 && p.commissionStartWeek <= p.weeks && (
                            <ReferenceLine x={p.commissionStartWeek} stroke="rgba(240,160,48,0.6)" strokeWidth={1} strokeDasharray="4 3"
                              label={{ value: "Comm.", fill: "#f0a030", fontSize: 8, fontFamily: "ui-monospace,monospace", position: "insideTopLeft" }} />
                          )}
                          <Line dataKey="p95" stroke="#4d9cf5"             strokeWidth={1}   strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                          <Line dataKey="p75" stroke="rgba(0,204,122,0.65)" strokeWidth={1}  strokeDasharray="3 2" dot={false} isAnimationActive={false} />
                          <Line dataKey="p50" stroke="#00cc7a"             strokeWidth={2.5}              dot={false} isAnimationActive={false} />
                          <Line dataKey="p25" stroke="rgba(240,160,48,0.65)" strokeWidth={1} strokeDasharray="3 2" dot={false} isAnimationActive={false} />
                          <Line dataKey="p5"  stroke="#f03a57"             strokeWidth={1}   strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}

                {!authed && (
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={spaghettiData}>
                        <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: "rgba(142,163,190,0.65)", fontSize: 9.5, fontFamily: "ui-monospace,monospace" }} tickFormatter={(v) => `W${v}`} interval={Math.floor(spaghettiData.length / 8)} />
                        <YAxis scale="log" domain={["auto","auto"]} axisLine={false} tickLine={false} tick={{ fill: "rgba(142,163,190,0.65)", fontSize: 9.5, fontFamily: "ui-monospace,monospace" }} tickFormatter={yFmt} width={50} />
                        {spaghettiKeys.map((key) => (
                          <Line key={key} type="monotone" dataKey={key} stroke="rgba(0,204,122,0.07)" strokeWidth={1} dot={false} isAnimationActive={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Efficiency + Regime */}
              <div>
                <p className="panel-title" style={{ marginBottom: 2 }}>Operator Efficiency + Regime Penalty — Median Path</p>
                <p className="label-xs" style={{ marginBottom: 6 }}>
                  OU(μ={`${(p.operatorMeanEff * 100).toFixed(0)}%`}, σ=7.5%, θ=0.35)
                  {p.efficiencyStdDev > 0 && ` + extra σ=${(p.efficiencyStdDev*100).toFixed(1)}%`}
                  {" · dashed = regime_penalty"}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 12px", marginBottom: 6 }}>
                  {[["≥95%","#00e88c","1.18×"],["80–95%","#00cc7a","1.00×"],["50–80%","#f0a030","0.60×"],["<50%","#f03a57","0.30×"]].map(([l,c,m]) => (
                    <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 1.5, background: c, display: "block" }} />
                      <span style={{ fontSize: 8.5, color: "rgba(142,163,190,0.65)" }}>{l} mult={m}</span>
                    </div>
                  ))}
                </div>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={effData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#00cc7a" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#00cc7a" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: "rgba(142,163,190,0.65)", fontSize: 9.5 }} tickFormatter={(v) => `W${v}`} interval={xi} />
                      <YAxis domain={[0.35, 1.08]} axisLine={false} tickLine={false} tick={{ fill: "rgba(142,163,190,0.65)", fontSize: 9.5 }} tickFormatter={(v) => `${(v*100).toFixed(0)}%`} />
                      <Tooltip content={<EffTip />} cursor={{ stroke: "rgba(255,255,255,0.10)", strokeWidth: 1 }} />
                      <ReferenceLine y={0.95} stroke="#00e88c" strokeWidth={1} strokeDasharray="3 3" label={{ value: "Exc.", fill: "#00e88c", fontSize: 7.5, position: "insideTopRight" }} />
                      <ReferenceLine y={0.80} stroke="#00cc7a" strokeWidth={1} strokeDasharray="3 3" label={{ value: "Norm.", fill: "#00cc7a", fontSize: 7.5, position: "insideTopRight" }} />
                      <ReferenceLine y={0.50} stroke="#f0a030" strokeWidth={1} strokeDasharray="3 3" label={{ value: "Red.", fill: "#f0a030", fontSize: 7.5, position: "insideTopRight" }} />
                      <ReferenceLine y={0.40} stroke="#f03a57" strokeWidth={1} strokeDasharray="3 3" label={{ value: "Halt", fill: "#f03a57", fontSize: 7.5, position: "insideTopRight" }} />
                      <Area type="monotone"  dataKey="eff"    stroke="#00cc7a"             strokeWidth={1.5} fill="url(#eg)" dot={false} isAnimationActive={false} />
                      <Area type="stepAfter" dataKey="regime" stroke="rgba(240,58,87,0.60)" strokeWidth={1.5} fill="none"      dot={false} isAnimationActive={false} strokeDasharray="3 2" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Terminal distribution — authed */}
              {authed && histData.length > 0 && (
                <div>
                  <p className="panel-title" style={{ marginBottom: 2 }}>Terminal Wealth Distribution</p>
                  <p className="label-xs" style={{ marginBottom: 8 }}>Frequency across 1 000 paths · green = P50 median bucket</p>
                  <div style={{ height: 120 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={histData} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fill: "rgba(142,163,190,0.55)", fontSize: 7.5, fontFamily: "ui-monospace,monospace" }} axisLine={false} tickLine={false} interval={2} />
                        <YAxis tick={{ fill: "rgba(142,163,190,0.55)", fontSize: 9 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<HistTip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                        <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                          {histData.map((entry, i) => <Cell key={i} fill={entry.isMedian ? "#00cc7a" : "rgba(0,204,122,0.20)"} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* DD distribution — authed */}
              {authed && ddHistData.length > 0 && (
                <div>
                  <p className="panel-title" style={{ marginBottom: 2 }}>Max Drawdown Distribution</p>
                  <p className="label-xs" style={{ marginBottom: 8 }}>Per-path peak-to-trough DD · red = mean DD across all paths</p>
                  <div style={{ height: 110 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ddHistData} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fill: "rgba(142,163,190,0.55)", fontSize: 7.5, fontFamily: "ui-monospace,monospace" }} axisLine={false} tickLine={false} interval={1} />
                        <YAxis tick={{ fill: "rgba(142,163,190,0.55)", fontSize: 9 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<DDHistTip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                        <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                          {ddHistData.map((entry, i) => <Cell key={i} fill={entry.isMean ? "#f03a57" : "rgba(240,58,87,0.22)"} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Year milestones */}
              {authed && yearData.length > 0 && (
                <div>
                  <p className="panel-title" style={{ marginBottom: 8 }}>Year-End Milestones — P5 / Median / P95</p>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {["Year", "P5 — Bear", "P50 — Median", "P95 — Bull"].map((h, i) => (
                            <th key={h} className="mono" style={{ padding: "5px 12px", textAlign: i === 0 ? "left" : "right", fontSize: 8.5, letterSpacing: "0.10em", color: "var(--ink-2)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {yearData.map(({ year, p5, p50, p95 }) => (
                          <tr key={year} style={{ borderBottom: "1px solid var(--line)" }}>
                            <td className="mono" style={{ padding: "7px 12px", color: "var(--ink-2)", fontSize: 11 }}>Yr {year}</td>
                            <td className="mono" style={{ padding: "7px 12px", color: "#f03a57", textAlign: "right", fontSize: 11 }}>{formatMultiple(p5)}×</td>
                            <td className="mono" style={{ padding: "7px 12px", color: "#00cc7a", textAlign: "right", fontWeight: 700, fontSize: 12 }}>{formatMultiple(p50)}×</td>
                            <td className="mono" style={{ padding: "7px 12px", color: "#4d9cf5", textAlign: "right", fontSize: 11 }}>{formatMultiple(p95)}×</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tier bar */}
              {res && (
                <div>
                  <p className="label-xs" style={{ marginBottom: 6, fontSize: 8.5 }}>OPERATOR TIER MIX — 1,000 paths × {p.weeks} weeks</p>
                  <div style={{ display: "flex", gap: 2, height: 12, borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                    {[
                      { pct: res.effStats.pctExcellence, c: "#00e88c" },
                      { pct: res.effStats.pctNormal,     c: "#00cc7a" },
                      { pct: res.effStats.pctReduced,    c: "#f0a030" },
                      { pct: res.effStats.pctCritical,   c: "#f03a57" },
                      { pct: res.effStats.pctHalted,     c: "#5a0e1a"  },
                    ].map(({ pct, c }, i) => pct > 0.3 && (
                      <div key={i} title={`${pct.toFixed(1)}%`} style={{ background: c, width: `${pct}%`, opacity: 0.82 }} />
                    ))}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 12px" }}>
                    {[
                      ["Excellence ≥95%", res.effStats.pctExcellence, "#00e88c"],
                      ["Normal 80–95%",   res.effStats.pctNormal,     "#00cc7a"],
                      ["Reduced 50–80%",  res.effStats.pctReduced,    "#f0a030"],
                      ["Crit/Halt <50%",  res.effStats.pctCritical + res.effStats.pctHalted, "#f03a57"],
                      ["Regime cuts",     res.regimeStats.pctHaircut + res.regimeStats.pctToxic, "#c0392b"],
                    ].map(([label, pct, c]) => (
                      <div key={label as string} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <span style={{ width: 6, height: 6, borderRadius: 1, background: c as string }} />
                        <span style={{ fontSize: 8.5, color: "rgba(142,163,190,0.70)" }}>{label}</span>
                        <span className="mono" style={{ fontSize: 8.5, fontWeight: 700, color: c as string }}>{(pct as number).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats grid — decision metrics first */}
              {res && (
                <div>
                  {authed && analystMetrics && (
                    <>
                      <p className="label-xs" style={{ marginBottom: 6, fontSize: 8.5 }}>DECISION METRICS</p>
                      <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", marginBottom: 12 }}>
                        <StatCard label="P50 CAGR"    value={`${(analystMetrics.annualCAGR * 100).toFixed(1)}%`} accent="#00cc7a" sub="annualised" />
                        <StatCard label="Calmar"      value={analystMetrics.calmar >= 99 ? "∞" : analystMetrics.calmar.toFixed(2)}
                                  accent={analystMetrics.calmar > 1.5 ? "#00cc7a" : analystMetrics.calmar > 0.8 ? "#f0a030" : "#f03a57"} sub="CAGR ÷ DD" />
                        <StatCard label="Ruin Rate"   value={`${res.pctRuined.toFixed(1)}%`} accent={res.pctRuined > 5 ? "#f03a57" : "#00cc7a"} sub="paths → 0" />
                        <StatCard label="Avg Max DD"  value={`−${(res.meanMaxDD * 100).toFixed(1)}%`} accent="#f03a57" sub="mean worst" />
                      </div>
                      <p className="label-xs" style={{ marginBottom: 6, fontSize: 8.5 }}>SUPPORTING METRICS</p>
                    </>
                  )}
                  <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))" }}>
                    <StatCard label="Median"        value={`${formatMultiple(res.medianTerminal)}×`} accent="#00cc7a" />
                    <StatCard label="P5"            value={`${formatMultiple(res.p5Terminal)}×`}     accent="#4d9cf5" />
                    <StatCard label="P95"           value={`${formatMultiple(res.p95Terminal)}×`}    accent="#00cc7a" />
                    <StatCard label="Worst Path"    value={`${formatMultiple(res.worstTerminal)}×`}  accent="#f03a57" />
                    {authed && <>
                      <StatCard label="Mean Terminal" value={`${formatMultiple(res.meanTerminal)}×`}  accent="#00cc7a" />
                      <StatCard label="Worst DD"      value={`−${(res.worstMaxDD * 100).toFixed(1)}%`} accent="#f03a57" />
                      <StatCard label="Mean Eff"      value={`${(res.meanMeanEff * 100).toFixed(1)}%`} accent="#f0a030" sub="avg operator" />
                      <StatCard label="Avg Regime"    value={`${res.meanRegimePenalty.toFixed(3)}×`}   accent={res.meanRegimePenalty < 0.98 ? "#f03a57" : "#8ea3be"} sub="streak mult" />
                      <StatCard label="Commission"    value={res.meanTotalComm > 0 ? `${(res.meanTotalComm * 100).toFixed(2)}%` : "—"} accent="#f0a030" sub="of initial cap" />
                      <StatCard label="Injection"     value={res.meanTotalInj > 0 ? `${(res.meanTotalInj * 100).toFixed(1)}%` : "—"} accent="#00cc7a" sub="received total" />
                      {analystMetrics && (
                        <StatCard label="Edge Half-Life" value={analystMetrics.edgeHL === Infinity ? "stable" : `${analystMetrics.edgeHL.toFixed(0)}q`}
                                  accent={analystMetrics.edgeHL < 20 ? "#f03a57" : "#8ea3be"} sub="to halve expect." />
                      )}
                      {res.meanGovernorPaid > 0 && (
                        <StatCard label="Gov. Fees" value={`${(res.meanGovernorPaid * 100).toFixed(2)}%`} accent="#c084fc" sub="total incentive" />
                      )}
                      {(p.captureRateStdDev > 0 || p.captureRateMean !== 1.0) && (
                        <StatCard label="Avg Capture" value={`${(res.meanCaptureRate * 100).toFixed(1)}%`} accent="#f0a030" sub="eff × captureAdj" />
                      )}
                    </>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
