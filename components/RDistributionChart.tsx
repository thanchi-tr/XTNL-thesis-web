"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, ResponsiveContainer,
} from "recharts";

const DATA = [
  { label: "-1 to -0.8R", freq: 26.42, loss: true  },
  { label: "-0.8–-0.4R",  freq: 7.55,  loss: true  },
  { label: "-0.4–0R",     freq: 25.47, loss: true  },
  { label: "1–2R",        freq: 1.89,  loss: false },
  { label: "2–3R",        freq: 15.09, loss: false },
  { label: "3–4R",        freq: 13.21, loss: false },
  { label: "4–5R",        freq: 4.72,  loss: false },
  { label: "5–6R",        freq: 0.94,  loss: false },
  { label: "6–9R",        freq: 4.72,  loss: false },
];

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const val    = payload[0].value;
  const isLoss = DATA.find((d) => d.label === label)?.loss ?? false;

  return (
    <div style={{
      background: "#1a2d45",
      border: `2px solid ${isLoss ? "#f03a57" : "#00cc7a"}`,
      borderRadius: 8,
      padding: "14px 18px",
      boxShadow: "0 16px 48px rgba(0,0,0,0.85)",
      fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
      minWidth: 150,
    }}>
      <p style={{ fontSize: 10, color: "#8ea3be", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
        R Range
      </p>
      <p style={{ fontSize: 15, color: "#ffffff", fontWeight: 700, marginBottom: 12 }}>
        {label}
      </p>
      <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.1)", marginBottom: 12 }} />
      <p style={{ fontSize: 10, color: "#8ea3be", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
        Frequency
      </p>
      <p style={{ fontSize: 22, fontWeight: 800, color: isLoss ? "#ff5c78" : "#00e88c", lineHeight: 1 }}>
        {val.toFixed(2)}%
      </p>
    </div>
  );
}

export default function RDistributionChart() {
  return (
    <div
      className="card overflow-hidden"
      style={{ marginTop: 16, boxShadow: "var(--shadow-sm)" }}
    >
      <div style={{
        padding: "12px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "#08111d",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 8,
      }}>
        <span className="panel-title">R-Multiple Distribution</span>
        <div style={{ display: "flex", gap: 8 }}>
          <span className="chip chip-green">N = 106</span>
          <span className="chip chip-muted">SESSION_FILTERED</span>
        </div>
      </div>

      <div style={{ padding: "10px 20px 0", display: "flex", gap: 20 }}>
        {[["#f03a57","Loss zone"],["#00cc7a","Win zone"]].map(([c, l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: "block" }}/>
            <span style={{ fontSize: 10, color: "rgba(142,163,190,0.7)" }}>{l}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: "8px 12px 16px", height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={DATA} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={false} tickLine={false}
              tick={{ fill: "rgba(142,163,190,0.7)", fontSize: 9, fontFamily: "ui-monospace, monospace" }}
            />
            <YAxis
              axisLine={false} tickLine={false}
              tick={{ fill: "rgba(142,163,190,0.7)", fontSize: 10, fontFamily: "ui-monospace, monospace" }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
            />
            <Bar dataKey="freq" radius={[3, 3, 0, 0]} maxBarSize={52} isAnimationActive>
              {DATA.map((d, i) => (
                <Cell key={i} fill={d.loss ? "rgba(240,58,87,0.80)" : "rgba(0,204,122,0.80)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
