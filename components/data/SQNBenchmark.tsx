"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, ReferenceLine, ResponsiveContainer,
} from "recharts";

const DATA = [
  { name: "Avg Retail Trader", sqn: -0.8,  cat: "retail"  },
  { name: "Marginal System",   sqn: 0.5,   cat: "marginal" },
  { name: "Good System",       sqn: 1.2,   cat: "good"    },
  { name: "Very Good",         sqn: 2.0,   cat: "good"    },
  { name: "Excellent",         sqn: 3.0,   cat: "great"   },
  { name: "XTNL (Elite)",      sqn: 4.253, cat: "xtnl"    },
  { name: "Holy Grail",        sqn: 5.0,   cat: "great"   },
];

const COLOR: Record<string, string> = {
  retail:   "rgba(240,58,87,0.70)",
  marginal: "rgba(240,160,48,0.50)",
  good:     "rgba(77,156,245,0.60)",
  great:    "rgba(0,204,122,0.55)",
  xtnl:     "rgba(0,204,122,1.00)",
};

function CustomTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number; payload?: { cat?: string } }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  const cat  = payload[0].payload?.cat ?? "";
  const isXT = cat === "xtnl";
  return (
    <div style={{ background: "#1a2d45", border: `2px solid ${isXT ? "#00cc7a" : "rgba(255,255,255,0.15)"}`, borderRadius: 8, padding: "12px 16px", fontFamily: "ui-monospace,monospace", boxShadow: "0 16px 48px rgba(0,0,0,0.85)", minWidth: 150 }}>
      <p style={{ fontSize: 13, color: "#ffffff", fontWeight: 700, marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 9, color: "#9ab0c8", marginBottom: 4 }}>SQN</p>
      <p style={{ fontSize: 20, fontWeight: 800, color: COLOR[cat] ?? "#9ab0c8", lineHeight: 1 }}>
        {payload[0].value.toFixed(3)}
      </p>
      {isXT && (
        <p style={{ fontSize: 9, color: "#00cc7a", marginTop: 8, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Live Production System
        </p>
      )}
    </div>
  );
}

export default function SQNBenchmark() {
  return (
    <div className="card overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div style={{
        padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "#07101c", display: "flex", alignItems: "center",
        justifyContent: "space-between", flexWrap: "wrap", gap: 8,
      }}>
        <span className="panel-title">SQN Industry Benchmark</span>
        <div style={{ display: "flex", gap: 8 }}>
          <span className="chip chip-green pulsing">XTNL: 4.253</span>
          <span className="chip chip-muted">Van Tharp Scale</span>
        </div>
      </div>

      <div style={{ padding: "14px 12px 8px", height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={DATA} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis
              type="number" domain={[-1.5, 5.5]}
              axisLine={false} tickLine={false}
              tick={{ fill: "rgba(154,176,200,0.7)", fontSize: 10, fontFamily: "ui-monospace,monospace" }}
            />
            <YAxis
              type="category" dataKey="name" axisLine={false} tickLine={false}
              tick={{ fill: "rgba(154,176,200,0.85)", fontSize: 11, fontFamily: "var(--font-inter),sans-serif" }}
              width={128}
            />
            <ReferenceLine x={0} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar dataKey="sqn" radius={[0, 4, 4, 0]} maxBarSize={28} isAnimationActive>
              {DATA.map((d, i) => <Cell key={i} fill={COLOR[d.cat]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ padding: "10px 20px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "var(--ink-2)", lineHeight: 1.7 }}>
        Van Tharp SQN classification. XTNL at 4.253 sits in the{" "}
        <span style={{ color: "var(--green)", fontWeight: 600 }}>Elite (&gt;3.0)</span>{" "}
        tier — achieved by fewer than 1 in 1,000 trading systems.
      </div>
    </div>
  );
}
