"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, AreaChart, Area,
} from "recharts";
import { startTransition } from "react";
import {
  runSimulation, formatMultiple,
  type SimParams, type SimSummary,
} from "@/lib/simulation";
import SliderControl from "@/components/ui/SliderControl";

/* ── Defaults from live system data ─────────────────────── */
const DEFAULT: SimParams = {
  /* Edge */
  baseRiskPct:         0.70,    // Recommend R = 0.007 (SESSION_FILTERED)
  expPerTrade:         0.982,   // SESSION_FILTERED μ
  tradesPerWeek:       8,       // live avg trades/week
  volPerTrade:         2.4,
  edgeDecayPctPerQtr:  3,

  /* Operator */
  operatorMeanEff:     0.82,    // live inferred efficiency rating

  /* Commission */
  commissionStartWeek: 52,      // distribute after 1 year of operation

  /* Injection */
  frozenPoolPct:       0,       // off by default — enable to model 4-wk gate

  /* Risk controls */
  taxRatePct:          47,      // ATO max marginal + 2% Medicare
  maxDDLimit:          0,       // off
  weeks:               260,     // 5 years
};

const PRESETS = [
  { label: "Baseline",    icon: "◎", p: { operatorMeanEff: 0.82, edgeDecayPctPerQtr: 3,   baseRiskPct: 0.70 } },
  { label: "Pessimistic", icon: "↘", p: { operatorMeanEff: 0.70, edgeDecayPctPerQtr: 6,   baseRiskPct: 0.50 } },
  { label: "Optimistic",  icon: "↗", p: { operatorMeanEff: 0.92, edgeDecayPctPerQtr: 1.5, baseRiskPct: 0.85 } },
];

/* ─────────────────────────────────────────────────────────
   Sub-components
   ───────────────────────────────────────────────────────── */
function SectionHead({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p className="label-xs" style={{ color: "rgba(0,204,122,0.85)", marginBottom: 3 }}>
        {icon} {title}
      </p>
      {sub && <p style={{ fontSize: 10, color: "rgba(142,163,190,0.55)", lineHeight: 1.5 }}>{sub}</p>}
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

function ChartTip({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1a2d45", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "10px 14px", fontFamily: "ui-monospace,monospace", boxShadow: "0 12px 40px rgba(0,0,0,0.8)" }}>
      <p style={{ fontSize: 10, color: "#8ea3be", marginBottom: 5 }}>Week {label}</p>
      <p style={{ fontSize: 15, color: "#fff", fontWeight: 700 }}>{payload[0].value.toFixed(3)}×</p>
    </div>
  );
}

function EffTip({ active, payload, label }: {
  active?: boolean; payload?: { value: number; dataKey?: string }[]; label?: number;
}) {
  if (!active || !payload?.length) return null;
  const eff = payload.find(p => p.dataKey === "eff")?.value ?? 0;
  const reg = payload.find(p => p.dataKey === "regime")?.value ?? 1;
  const tier = eff >= 0.95 ? "Excellence" : eff >= 0.80 ? "Normal" : eff >= 0.50 ? "Reduced" : "Critical/Halt";
  const c    = eff >= 0.95 ? "#00e88c" : eff >= 0.80 ? "#00cc7a" : eff >= 0.50 ? "#f0a030" : "#f03a57";
  return (
    <div style={{ background: "#1a2d45", border: `1px solid ${c}45`, borderRadius: 6, padding: "12px 14px", fontFamily: "ui-monospace,monospace", boxShadow: "0 12px 40px rgba(0,0,0,0.8)", minWidth: 160 }}>
      <p style={{ fontSize: 10, color: "#8ea3be", marginBottom: 8 }}>Week {label}</p>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 5 }}>
        <span style={{ fontSize: 10, color: "#8ea3be" }}>Efficiency</span>
        <span className="mono" style={{ fontSize: 13, color: c, fontWeight: 800 }}>{(eff*100).toFixed(1)}%</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: "#8ea3be" }}>Regime Penalty</span>
        <span className="mono" style={{ fontSize: 13, color: reg < 1 ? "#f03a57" : "#8ea3be", fontWeight: 700 }}>{reg.toFixed(2)}×</span>
      </div>
      <p style={{ fontSize: 9, color: c, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" }}>{tier}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════════════ */
export default function MonteCarloSimulator() {
  const [p,       setP]       = useState<SimParams>(DEFAULT);
  const [res,     setRes]     = useState<SimSummary | null>(null);
  const [running, setRunning] = useState(false);
  const [eqData,  setEqData]  = useState<Record<string, number>[]>([]);
  const [effData, setEffData] = useState<{ week: number; eff: number; regime: number }[]>([]);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildEqData = useCallback((paths: number[][], weeks: number) => {
    const out: Record<string, number>[] = [];
    for (let w = 0; w < weeks; w++) {
      const pt: Record<string, number> = { week: w + 1 };
      paths.forEach((path, i) => { if (path[w] !== undefined) pt[`p${i}`] = path[w]; });
      out.push(pt);
    }
    return out;
  }, []);

  const buildEffData = useCallback((effSamples: number[][], regSamples: number[][], weeks: number) => {
    const medEff = effSamples[Math.floor(effSamples.length / 2)] ?? effSamples[0];
    const medReg = regSamples[Math.floor(regSamples.length / 2)] ?? regSamples[0];
    return Array.from({ length: weeks }, (_, w) => ({
      week: w + 1,
      eff:   medEff[w] ?? 0.82,
      regime: medReg[w] ?? 1.0,
    }));
  }, []);

  const simulate = useCallback((params: SimParams) => {
    setRunning(true);
    // setTimeout(0) yields to the browser so the slider paint completes first,
    // then startTransition marks the heavy state updates as non-urgent so React
    // doesn't block input events while committing the 1000-path result.
    setTimeout(() => {
      const s = runSimulation(params, 1000);
      startTransition(() => {
        setRes(s);
        setEqData(buildEqData(s.paths, params.weeks));
        setEffData(buildEffData(s.effPathSamples, s.regPathSamples, params.weeks));
        setRunning(false);
      });
    }, 0);
  }, [buildEqData, buildEffData]);

  useEffect(() => { simulate(DEFAULT); }, [simulate]);

  const update = useCallback((key: keyof SimParams, val: number) => {
    const next = { ...p, [key]: val };
    setP(next);                                       // instant formula strip update
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => simulate(next), 220); // debounce the heavy work
  }, [p, simulate]);

  const applyPreset = (preset: Partial<SimParams>) => {
    const next = { ...p, ...preset };
    setP(next); simulate(next);
  };

  const pathKeys = res ? res.paths.map((_, i) => `p${i}`) : [];
  const yFmt     = (v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}K×` : `${v.toFixed(1)}×`;
  const liveEff  = p.operatorMeanEff;
  const liveReg  = res?.meanRegimePenalty ?? 1.0;
  const livePerfMult = liveEff < 0.40 ? 0 : liveEff < 0.50 ? 0.30 : liveEff < 0.80 ? 0.60 : liveEff >= 0.95 ? 1.18 : 1.0;
  const liveApplied  = (p.baseRiskPct * livePerfMult * liveReg * 0.95).toFixed(3);

  return (
    <div className="card" style={{ overflow: "hidden", boxShadow: "var(--shadow-lg)" }}>

      {/* ── Risk formula strip ────────────────────────────── */}
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

      {/* ── Presets ──────────────────────────────────────── */}
      <div style={{ padding: "8px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span className="label-xs" style={{ marginRight: 4 }}>Scenario:</span>
        {PRESETS.map(({ label, icon, p: preset }) => (
          <button key={label} className="btn btn-ghost" style={{ fontSize: 10, padding: "4px 12px" }} onClick={() => applyPreset(preset)}>
            {icon} {label}
          </button>
        ))}
      </div>

      <div className="sim-body">

        {/* ══════════════════════════════════════════════
            CONTROLS SIDEBAR
            ══════════════════════════════════════════════ */}
        <div className="sim-controls" style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 24 }}>

          {/* ── Operator ─────────────────────────────── */}
          <div>
            <SectionHead
              icon="🧠"
              title="Operator (OU Process)"
              sub="Efficiency tracks a mean-reverting random walk: θ=0.35 (reversion), σ=7.5% (weekly volatility). Shocks persist ~3 weeks before normalising."
            />
            <SliderControl
              label="Mean Efficiency μ_eff"
              value={p.operatorMeanEff}
              displayValue={`${(p.operatorMeanEff*100).toFixed(0)}%`}
              min={0.60} max={0.98} step={0.01}
              tooltip="Long-run mean the OU process reverts toward. Live system: 82.2%."
              onChange={(v) => update("operatorMeanEff", v)}
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
            <SectionHead
              icon="🎯"
              title="Edge Parameters"
              sub="All trades simulated individually within each week — losing streak tracks per-trade. MC95 losing streak threshold = 12 trades (from live SESSION_FILTERED data)."
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <SliderControl
                label="Base Risk θ  (% of account)"
                value={p.baseRiskPct}
                displayValue={`${p.baseRiskPct.toFixed(2)}%`}
                min={0.1} max={2.0} step={0.01}
                tooltip="CVaR-derived position size per 1R trade. Multiplied by perf_mult × regime × 0.95 each week. Live: 0.70%."
                onChange={(v) => update("baseRiskPct", v)}
              />
              <SliderControl
                label="Expectancy μ  (R per trade)"
                value={p.expPerTrade}
                displayValue={`${p.expPerTrade.toFixed(3)} R`}
                min={0.1} max={2.0} step={0.01}
                tooltip="Mean R-multiple per trade. Erodes quarterly by edge decay. Live: 0.982 R."
                onChange={(v) => update("expPerTrade", v)}
              />
              <SliderControl
                label="Trades / Week"
                value={p.tradesPerWeek}
                displayValue={`${p.tradesPerWeek}`}
                min={1} max={25} step={1}
                tooltip="Validated entries per week. Each trade is simulated individually for accurate losing-streak tracking."
                onChange={(v) => update("tradesPerWeek", v)}
              />
              <SliderControl
                label="Volatility σ  (R per trade)"
                value={p.volPerTrade}
                displayValue={`${p.volPerTrade.toFixed(1)} R`}
                min={0.5} max={10} step={0.1}
                tooltip="Per-trade R std deviation. Higher = wider distribution of outcomes."
                onChange={(v) => update("volPerTrade", v)}
              />
              <SliderControl
                label="Edge Decay  (% per quarter)"
                value={p.edgeDecayPctPerQtr}
                displayValue={`${p.edgeDecayPctPerQtr.toFixed(1)}%`}
                min={0} max={15} step={0.5}
                tooltip="Expectancy erodes every 13 weeks as the market adapts to the edge."
                onChange={(v) => update("edgeDecayPctPerQtr", v)}
              />
            </div>
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />

          {/* ── Commission ───────────────────────────── */}
          <div>
            <SectionHead
              icon="💰"
              title="Commission Distribution"
              sub="Mirrors current_commission_generator.py. Gate: eff ≥ 88%. Commission deducted from equity each qualifying week after the start delay."
            />
            <SliderControl
              label="Distribution Starts  (week)"
              value={p.commissionStartWeek}
              displayValue={`W${p.commissionStartWeek} (Yr ${Math.ceil(p.commissionStartWeek/52)})`}
              min={0} max={260} step={4}
              tooltip="Weeks before commission payments begin. Allows the account to build before extracting operator fees."
              onChange={(v) => update("commissionStartWeek", v)}
            />
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
            <SectionHead
              icon="💎"
              title="Capital Injection"
              sub="Mirrors memory_generator.py 4-week gate logic. Pool grows with excellence (1.20× volatility-shielded scaling). Resets to baseline on any disqualifying week."
            />
            <SliderControl
              label="Frozen Pool  (% of initial cap)"
              value={p.frozenPoolPct}
              displayValue={p.frozenPoolPct === 0 ? "Off" : `${(p.frozenPoolPct*100).toFixed(0)}% / period`}
              min={0} max={1.0} step={0.05}
              tooltip="Capital injected each qualifying 4-week period. Pool grows with consecutive excellence streaks."
              onChange={(v) => update("frozenPoolPct", v)}
            />
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
            <SectionHead icon="🛡️" title="Risk Controls" />
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <SliderControl
                label="Tax Rate  (ATO annual)"
                value={p.taxRatePct}
                displayValue={`${p.taxRatePct.toFixed(0)}%`}
                min={0} max={47} step={1}
                tooltip="Applied to realised gains each year-end. 47% = ATO top marginal + 2% Medicare."
                onChange={(v) => update("taxRatePct", v)}
              />
              <SliderControl
                label="DD Halt  (% threshold)"
                value={p.maxDDLimit}
                displayValue={p.maxDDLimit === 0 ? "Off" : `-${p.maxDDLimit}%`}
                min={0} max={60} step={5}
                tooltip="Halt a simulation path if drawdown exceeds this percentage from peak."
                onChange={(v) => update("maxDDLimit", v)}
              />
              <SliderControl
                label="Horizon  (weeks)"
                value={p.weeks}
                displayValue={`${p.weeks}w · ${Math.round(p.weeks/52)}yr`}
                min={52} max={520} step={1}
                tooltip="Total simulation duration."
                onChange={(v) => update("weeks", v)}
              />
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            CHART PANEL
            ══════════════════════════════════════════════ */}
        <div style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>

          {/* ── Equity chart ──────────────────────────── */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
              <div>
                <p className="panel-title">1,000-Iteration Equity Convergence</p>
                <p className="label-xs" style={{ marginTop: 3 }}>
                  Log scale · Post-commission · Post-tax · OU operator + regime-gated risk
                </p>
              </div>
              <button className="btn btn-primary" style={{ fontSize: 10, padding: "7px 16px" }} onClick={() => simulate(p)} disabled={running}>
                {running ? "Running…" : "Re-Run ↻"}
              </button>
            </div>

            <div style={{ height: 280, minHeight: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={eqData}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: "rgba(142,163,190,0.7)", fontSize: 10, fontFamily: "ui-monospace,monospace" }} tickFormatter={(v) => `W${v}`} interval={Math.floor(p.weeks/8)} />
                  <YAxis scale="log" domain={["auto","auto"]} axisLine={false} tickLine={false} tick={{ fill: "rgba(142,163,190,0.7)", fontSize: 10, fontFamily: "ui-monospace,monospace" }} tickFormatter={yFmt} width={52} />
                  <Tooltip content={<ChartTip />} cursor={{ stroke: "rgba(255,255,255,0.10)", strokeWidth: 1 }} />
                  {p.commissionStartWeek > 0 && p.commissionStartWeek <= p.weeks && (
                    <ReferenceLine x={p.commissionStartWeek} stroke="rgba(240,160,48,0.6)" strokeWidth={1} strokeDasharray="4 3"
                      label={{ value: "Comm. starts", fill: "#f0a030", fontSize: 9, fontFamily: "ui-monospace,monospace", position: "insideTopLeft" }} />
                  )}
                  {pathKeys.map((key) => (
                    <Line key={key} type="monotone" dataKey={key} stroke="rgba(0,204,122,0.07)" strokeWidth={1} dot={false} isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Efficiency + Regime chart ─────────────── */}
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
                  <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: "rgba(142,163,190,0.7)", fontSize: 10 }} tickFormatter={(v) => `W${v}`} interval={Math.floor(p.weeks/8)} />
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
              <StatCard label="Mean Terminal"    value={`${formatMultiple(res.meanTerminal)}×`}           accent="#00cc7a" />
              <StatCard label="Median"           value={`${formatMultiple(res.medianTerminal)}×`}          accent="#00cc7a" />
              <StatCard label="P5"               value={`${formatMultiple(res.p5Terminal)}×`}              accent="#4d9cf5" />
              <StatCard label="P95"              value={`${formatMultiple(res.p95Terminal)}×`}             accent="#00cc7a" />
              <StatCard label="Worst Path"       value={`${formatMultiple(res.worstTerminal)}×`}           accent="#f03a57" />
              <StatCard label="Avg Max DD"       value={`−${(res.meanMaxDD*100).toFixed(1)}%`}             accent="#f03a57" />
              <StatCard label="Worst DD"         value={`−${(res.worstMaxDD*100).toFixed(1)}%`}            accent="#f03a57" />
              <StatCard label="Mean Eff"         value={`${(res.meanMeanEff*100).toFixed(1)}%`}            accent="#f0a030" sub="avg operator eff" />
              <StatCard label="Avg Regime"       value={`${res.meanRegimePenalty.toFixed(3)}×`}            accent={res.meanRegimePenalty < 0.98 ? "#f03a57" : "#8ea3be"} sub="streak penalty" />
              <StatCard
                label="Total Comm. Paid"
                value={res.meanTotalComm > 0 ? `${(res.meanTotalComm * 100).toFixed(2)}%` : "—"}
                accent="#f0a030"
                sub="of initial capital (all weeks)"
              />
              <StatCard
                label="Avg Comm. / Week"
                value={res.meanAvgCommPerWeek > 0 ? `${(res.meanAvgCommPerWeek * 100).toFixed(4)}%` : "—"}
                accent="#f0a030"
                sub="fraction of initial per week"
              />
              <StatCard label="Avg Injection"    value={res.meanTotalInj > 0 ? `${(res.meanTotalInj*100).toFixed(1)}%` : "—"} accent="#00cc7a" sub="of initial (received)" />
              <StatCard label="Inject Events"    value={res.meanInjEvents > 0 ? res.meanInjEvents.toFixed(1) : "—"} accent="#00cc7a" sub="qualifying 4-wk periods" />
              <StatCard label="Ruin Rate"        value={`${res.pctRuined.toFixed(1)}%`}                   accent={res.pctRuined > 5 ? "#f03a57" : "#00cc7a"} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
