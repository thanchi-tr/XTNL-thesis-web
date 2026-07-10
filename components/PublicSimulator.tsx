"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer,
  Tooltip, ReferenceLine,
} from "recharts";
import { startTransition } from "react";
import Link from "next/link";
import { runSimulation } from "@/lib/simulation";
import type { SimParams, SimSummary } from "@/lib/simulation";

/* ── Locked presets — user picks a name, never sees individual params ── */
const PRESETS = [
  {
    id: "baseline",
    label: "Baseline",
    tag: "Live parameters",
    color: "#4d9cf5",
    params: {
      baseRiskPct: 0.70, expPerTrade: 0.982, tradesPerWeek: 8, volPerTrade: 2.4,
      edgeDecayPctPerQtr: 3, operatorMeanEff: 0.82, commissionStartWeek: 52,
      frozenPoolPct: 0, taxRatePct: 47, maxDDLimit: 0, weeks: 260,
      fixedRatePct: 0, bonusRatePct: 0, bonusThreshold: 0.80,
      scalingConditions: [], efficiencyStdDev: 0,
      captureRateMean: 1.0, captureRateStdDev: 0, tradeFreqStdDev: 0,
    } as SimParams,
  },
  {
    id: "pessimistic",
    label: "Pessimistic",
    tag: "Stress scenario",
    color: "#f03a57",
    params: {
      baseRiskPct: 0.55, expPerTrade: 0.75, tradesPerWeek: 6, volPerTrade: 3.0,
      edgeDecayPctPerQtr: 6, operatorMeanEff: 0.72, commissionStartWeek: 52,
      frozenPoolPct: 0, taxRatePct: 47, maxDDLimit: 0, weeks: 260,
      fixedRatePct: 0, bonusRatePct: 0, bonusThreshold: 0.80,
      scalingConditions: [], efficiencyStdDev: 0,
      captureRateMean: 1.0, captureRateStdDev: 0, tradeFreqStdDev: 0,
    } as SimParams,
  },
  {
    id: "optimistic",
    label: "Optimistic",
    tag: "Enhanced scenario",
    color: "#00cc7a",
    params: {
      baseRiskPct: 0.85, expPerTrade: 1.15, tradesPerWeek: 10, volPerTrade: 2.0,
      edgeDecayPctPerQtr: 1.5, operatorMeanEff: 0.89, commissionStartWeek: 52,
      frozenPoolPct: 0, taxRatePct: 47, maxDDLimit: 0, weeks: 260,
      fixedRatePct: 0, bonusRatePct: 0, bonusThreshold: 0.80,
      scalingConditions: [], efficiencyStdDev: 0,
      captureRateMean: 1.0, captureRateStdDev: 0, tradeFreqStdDev: 0,
    } as SimParams,
  },
] as const;

type PresetId = (typeof PRESETS)[number]["id"];

/* ── Chart helpers ─────────────────────────────────────────────────── */
const WEEKS = 260;
const CHART_STEP = 8; // one point every 8 weeks

function buildChartData(summary: SimSummary): Array<Record<string, number>> {
  const paths = summary.paths;
  if (!paths.length) return [];

  /* Median path — sort by terminal, take middle */
  const sorted = [...paths].sort((a, b) => (a[a.length - 1] ?? 0) - (b[b.length - 1] ?? 0));
  const midIdx = Math.floor(sorted.length / 2);
  const medianPath = sorted[midIdx];

  /* 5 background paths spread across the distribution */
  const bgIndices = [
    Math.floor(sorted.length * 0.10),
    Math.floor(sorted.length * 0.25),
    Math.floor(sorted.length * 0.40),
    Math.floor(sorted.length * 0.65),
    Math.floor(sorted.length * 0.85),
  ];
  const bgPaths = bgIndices.map(i => sorted[Math.min(i, sorted.length - 1)]);

  const points: Array<Record<string, number>> = [];
  for (let w = 0; w <= WEEKS; w += CHART_STEP) {
    const pt: Record<string, number> = { w };
    bgPaths.forEach((p, idx) => { pt[`bg${idx}`] = p[Math.min(w, p.length - 1)] ?? 0; });
    pt.median = medianPath[Math.min(w, medianPath.length - 1)] ?? 0;
    points.push(pt);
  }
  return points;
}

/* ── Sub-components ─────────────────────────────────────────────────── */
function StatChip({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 3,
      padding: "14px 20px", background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8,
      minWidth: 100,
    }}>
      <span style={{ fontSize: 9, letterSpacing: "0.09em", color: "rgba(142,163,190,0.5)", fontFamily: "var(--font-mono)", fontWeight: 700, textTransform: "uppercase" }}>
        {label}
      </span>
      <span style={{ fontSize: 22, fontWeight: 800, color: "var(--ink-0)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: 10, color: "rgba(142,163,190,0.45)", fontFamily: "var(--font-mono)" }}>
          {sub}
        </span>
      )}
    </div>
  );
}

const YAxisTick = ({ x, y, payload }: any) => {
  const val = payload?.value as number;
  if (val <= 0 || (val < 1.5 && val !== 1)) return null;
  const label = val === 1 ? "1×" : `${Math.round(val)}×`;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill="rgba(142,163,190,0.35)" fontSize={9} fontFamily="var(--font-mono)">
      {label}
    </text>
  );
};

const XAxisTick = ({ x, y, payload }: any) => {
  const w = payload?.value as number;
  if (w % 52 !== 0) return null;
  return (
    <text x={x} y={y} dy={12} textAnchor="middle" fill="rgba(142,163,190,0.35)" fontSize={9} fontFamily="var(--font-mono)">
      {`Yr${w / 52}`}
    </text>
  );
};

/* ── Main component ─────────────────────────────────────────────────── */
export default function PublicSimulator() {
  const [activeId, setActiveId]   = useState<PresetId>("baseline");
  const [running, setRunning]     = useState(false);
  const [summary, setSummary]     = useState<SimSummary | null>(null);
  const [chartData, setChartData] = useState<Array<Record<string, number>>>([]);
  const reqId = useRef(0);

  const run = useCallback((presetId: PresetId) => {
    const preset = PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setRunning(true);
    const id = ++reqId.current;
    setTimeout(() => {
      const res = runSimulation(preset.params, 200);
      if (id !== reqId.current) return;
      startTransition(() => {
        setSummary(res);
        setChartData(buildChartData(res));
        setRunning(false);
      });
    }, 0);
  }, []);

  /* Run on mount */
  useEffect(() => { run("baseline"); }, [run]);

  const preset     = PRESETS.find(p => p.id === activeId)!;
  const accentColor = preset.color;

  const medianMultiple = summary ? summary.medianTerminal.toFixed(2) : "—";
  const ruinPct        = summary ? summary.pctRuined.toFixed(1) + "%" : "—";

  function handleSelect(id: PresetId) {
    setActiveId(id);
    run(id);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Preset selector ──────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {PRESETS.map(p => {
          const active = p.id === activeId;
          return (
            <button
              key={p.id}
              onClick={() => handleSelect(p.id)}
              disabled={running}
              style={{
                display: "flex", flexDirection: "column", gap: 3,
                padding: "10px 18px", borderRadius: 8, cursor: running ? "default" : "pointer",
                border: active ? `1.5px solid ${p.color}` : "1.5px solid rgba(255,255,255,0.07)",
                background: active ? `${p.color}12` : "rgba(255,255,255,0.01)",
                transition: "all 0.15s",
                outline: "none",
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: active ? p.color : "var(--ink-1)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
                {p.label.toUpperCase()}
              </span>
              <span style={{ fontSize: 9.5, color: "rgba(142,163,190,0.50)", fontFamily: "var(--font-mono)" }}>
                {p.tag}
              </span>
            </button>
          );
        })}

        {/* Running indicator */}
        {running && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", opacity: 0.6 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: accentColor, animation: "pulse 1s infinite" }} />
            <span style={{ fontSize: 10, color: "var(--ink-2)", fontFamily: "var(--font-mono)" }}>Simulating…</span>
          </div>
        )}
      </div>

      {/* ── Chart ──────────────────────────────────────────────────── */}
      <div style={{
        position: "relative",
        background: "rgba(255,255,255,0.015)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
        padding: "20px 16px 12px",
        minHeight: 260,
      }}>
        {/* Blurred overlay at top-right to obscure upper tails */}
        <div style={{
          position: "absolute", top: 0, right: 0,
          width: "35%", height: "45%",
          background: "linear-gradient(135deg, transparent 0%, rgba(10,12,18,0.70) 70%)",
          borderTopRightRadius: 10, pointerEvents: "none",
          zIndex: 2,
        }}>
          <div style={{
            position: "absolute", bottom: 12, right: 16, textAlign: "right",
          }}>
            <p style={{ fontSize: 8.5, color: "rgba(142,163,190,0.35)", fontFamily: "var(--font-mono)", letterSpacing: "0.07em", margin: 0 }}>
              FULL DISTRIBUTION
            </p>
            <p style={{ fontSize: 8.5, color: "rgba(142,163,190,0.25)", fontFamily: "var(--font-mono)", margin: "2px 0 0" }}>
              Sign in to unlock →
            </p>
          </div>
        </div>

        {/* Chart label */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: accentColor }} />
          <span style={{ fontSize: 9, letterSpacing: "0.09em", color: "rgba(142,163,190,0.45)", fontFamily: "var(--font-mono)", fontWeight: 700, textTransform: "uppercase" }}>
            Median Path · {preset.label} · 200 paths · 5yr
          </span>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <XAxis dataKey="w" tick={<XAxisTick />} axisLine={false} tickLine={false} interval={0} />
            <YAxis
              tick={<YAxisTick />}
              axisLine={false}
              tickLine={false}
              tickCount={5}
              width={28}
              domain={["auto", "auto"]}
            />
            <ReferenceLine y={1} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.06)", strokeWidth: 1 }}
              contentStyle={{
                background: "rgba(15,18,28,0.95)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6, fontSize: 10, fontFamily: "var(--font-mono)", padding: "8px 12px",
              }}
              labelFormatter={(w) => `Year ${((w as number) / 52).toFixed(1)}`}
              formatter={(v, name) => {
                if (name !== "median") return [null, null];
                return [`${(v as number).toFixed(2)}×`, "Median"];
              }}
              itemStyle={{ color: accentColor }}
              labelStyle={{ color: "rgba(142,163,190,0.6)", marginBottom: 4 }}
            />

            {/* Background paths */}
            {[0, 1, 2, 3, 4].map(idx => (
              <Line
                key={`bg${idx}`}
                type="monotone"
                dataKey={`bg${idx}`}
                stroke="rgba(142,163,190,0.12)"
                strokeWidth={1}
                dot={false}
                isAnimationActive={false}
              />
            ))}

            {/* Median path */}
            <Line
              type="monotone"
              dataKey="median"
              stroke={accentColor}
              strokeWidth={2}
              dot={false}
              isAnimationActive={!running}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <StatChip label="Median Outcome" value={`${medianMultiple}×`} sub="of initial capital" />
        <StatChip label="Ruin Rate" value={ruinPct} sub="paths reach near-zero" />
        <StatChip label="Horizon" value="5 yr" sub="260 weeks simulated" />
        <StatChip label="Paths" value="200" sub="locked demo" />
      </div>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap",
        padding: "16px 20px",
        background: "rgba(77,156,245,0.04)",
        border: "1px solid rgba(77,156,245,0.14)",
        borderRadius: 10,
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-1)", marginBottom: 4 }}>
            Full Strategist Workspace
          </p>
          <p style={{ fontSize: 11, color: "var(--ink-2)", lineHeight: 1.65, margin: 0 }}>
            Adjust every parameter — risk sizing, edge decay, governor incentives, operator model, scaling rules.
            1,000-path runs with percentile fan, terminal distribution, and analyst verdict.
          </p>
        </div>
        <Link href="/api/auth/signin" className="btn btn-primary" style={{ fontSize: 12, flexShrink: 0 }}>
          Sign in for full access →
        </Link>
      </div>
    </div>
  );
}
