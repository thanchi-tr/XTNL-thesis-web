"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, ReferenceLine, ResponsiveContainer,
} from "recharts";

const RAW = [
  1.051, 2.441, 4.570, 1.987, 1.120, 0.054, -1.252, -0.267,
  -0.796, 1.505, 1.794, -1.304, 1.526, 1.129, -0.654, 0.954,
  1.020, -0.708, 0.625, -0.853, 0.025, 0.407, 0.260, 0.324,
];

const DATA = RAW.map((exp, i) => ({
  hour: `${String(i).padStart(2, "0")}:00`,
  exp,
  blackout: i === 19,
}));

function barColor(val: number, blackout: boolean) {
  if (blackout)    return "#f03a57";
  if (val <= -0.5) return "rgba(240,58,87,0.80)";
  if (val < 0)     return "rgba(240,58,87,0.40)";
  if (val < 1.0)   return "rgba(0,204,122,0.30)";
  if (val < 2.0)   return "rgba(0,204,122,0.65)";
  return "rgba(0,204,122,0.90)";
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number; payload?: { blackout?: boolean } }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  const val      = payload[0].value;
  const blackout = payload[0].payload?.blackout;
  return (
    <div style={{ background: "#1a2d45", border: `2px solid ${val < 0 ? "#f03a57" : "#00cc7a"}`, borderRadius: 8, padding: "12px 16px", fontFamily: "ui-monospace, monospace", boxShadow: "0 16px 48px rgba(0,0,0,0.85)", minWidth: 150 }}>
      <p style={{ fontSize: 10, color: "#9ab0c8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Hour</p>
      <p style={{ fontSize: 15, color: "#fff", fontWeight: 700, marginBottom: 10 }}>
        {label}{blackout ? " ⚠" : ""}
      </p>
      <p style={{ fontSize: 10, color: "#9ab0c8", marginBottom: 5 }}>Expectancy</p>
      <p style={{ fontSize: 22, fontWeight: 800, color: val < 0 ? "#f03a57" : "#00cc7a", lineHeight: 1 }}>
        {val.toFixed(3)} R
      </p>
      {blackout && (
        <p style={{ fontSize: 9, color: "#f03a57", marginTop: 8, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Blackout Zone — Excised
        </p>
      )}
    </div>
  );
}

export default function HourlyHeatmap() {
  return (
    <div className="card overflow-hidden" style={{ marginTop: 16, boxShadow: "var(--shadow-sm)" }}>
      {/* Header */}
      <div style={{
        padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "#07101c", display: "flex", alignItems: "center",
        justifyContent: "space-between", flexWrap: "wrap", gap: 8,
      }}>
        <span className="panel-title">Hourly R-Expectancy Heatmap</span>
        <span className="chip chip-red">Hour 19 — Blackout</span>
      </div>

      {/* Chart */}
      <div style={{ padding: "12px 12px 8px", height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={DATA} margin={{ top: 8, right: 8, left: -14, bottom: 18 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="hour" axisLine={false} tickLine={false}
              tick={{ fill: "rgba(154,176,200,0.7)", fontSize: 9, fontFamily: "ui-monospace,monospace" }}
              angle={-45} textAnchor="end" interval={1}
            />
            <YAxis
              axisLine={false} tickLine={false}
              tick={{ fill: "rgba(154,176,200,0.7)", fontSize: 10, fontFamily: "ui-monospace,monospace" }}
              tickFormatter={(v) => `${v}R`}
            />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar dataKey="exp" radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive>
              {DATA.map((d, i) => <Cell key={i} fill={barColor(d.exp, d.blackout)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Footer */}
      <div style={{ padding: "8px 20px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: 1, background: "var(--red)", display: "block" }} />
        <span style={{ fontSize: 10, color: "var(--ink-2)", letterSpacing: "0.02em" }}>
          19:00–19:59 AEST — Hard blackout enforced. Catastrophic −0.853 R cluster mapped and excised.
        </span>
      </div>
    </div>
  );
}
