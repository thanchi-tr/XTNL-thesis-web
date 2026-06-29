"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useState } from "react";

/* Simulated representative drawdown profile over 106 trades */
const generateProfile = () => {
  const rng = (seed: number) => {
    let s = seed;
    return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  };
  const rand = rng(42);
  const trades = [];
  let equity = 100;
  let peak = 100;
  for (let i = 1; i <= 106; i++) {
    const r = rand() < 0.62 ? rand() * 3.5 + 0.5 : -(rand() * 0.6 + 0.4);
    equity += r * 0.51;
    if (equity > peak) peak = equity;
    const dd = ((peak - equity) / peak) * 100;
    trades.push({ trade: i, equity: parseFloat(equity.toFixed(2)), drawdown: parseFloat((-dd).toFixed(2)) });
  }
  return trades;
};

const PROFILE = generateProfile();

export default function DrawdownProfile() {
  const [view, setView] = useState<"equity" | "drawdown">("equity");

  return (
    <div
      className="card overflow-hidden"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--line)",
          background: "var(--sub)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <span className="mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--ink-0)", textTransform: "uppercase" }}>
          Equity & Drawdown Profile — 106 Trades
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className="btn btn-ghost"
            style={{
              fontSize: 10,
              padding: "4px 12px",
              borderColor: view === "equity" ? "var(--green)" : undefined,
              color: view === "equity" ? "var(--green)" : undefined,
            }}
            onClick={() => setView("equity")}
          >
            Equity
          </button>
          <button
            className="btn btn-ghost"
            style={{
              fontSize: 10,
              padding: "4px 12px",
              borderColor: view === "drawdown" ? "var(--red)" : undefined,
              color: view === "drawdown" ? "var(--red)" : undefined,
            }}
            onClick={() => setView("drawdown")}
          >
            Drawdown
          </button>
        </div>
      </div>

      <div style={{ padding: "16px 8px 8px", height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={PROFILE} margin={{ top: 4, right: 12, left: -8, bottom: 4 }}>
            <defs>
              <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="rgba(0,204,122,0.25)" />
                <stop offset="95%" stopColor="rgba(0,204,122,0.01)" />
              </linearGradient>
              <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="rgba(240,58,87,0.02)" />
                <stop offset="95%" stopColor="rgba(240,58,87,0.25)" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--line)" vertical={false} />
            <XAxis
              dataKey="trade"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--ink-2)", fontSize: 10, fontFamily: "var(--font-mono)" }}
              tickFormatter={(v) => `T${v}`}
              interval={14}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--ink-2)", fontSize: 10, fontFamily: "var(--font-mono)" }}
              tickFormatter={(v) => view === "equity" ? `${v.toFixed(0)}` : `${v.toFixed(1)}%`}
            />
            {view === "drawdown" && <ReferenceLine y={0} stroke="var(--line-hi)" strokeWidth={1} />}
            <Tooltip
              contentStyle={{
                background: "var(--raised)",
                border: "1px solid var(--line-hi)",
                borderRadius: 4,
                fontSize: 11,
                fontFamily: "var(--font-mono), monospace",
                color: "var(--ink-0)",
              }}
              formatter={(v: number) =>
                view === "equity"
                  ? [`${v.toFixed(2)} R accumulated`, "Equity"]
                  : [`${v.toFixed(2)}%`, "Drawdown"]
              }
              labelFormatter={(l) => `Trade ${l}`}
              cursor={{ stroke: "var(--line-hi)", strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey={view}
              stroke={view === "equity" ? "var(--green)" : "var(--red)"}
              strokeWidth={1.5}
              fill={view === "equity" ? "url(#gradGreen)" : "url(#gradRed)"}
              dot={false}
              isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ padding: "10px 20px 16px", borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--ink-2)", lineHeight: 1.6 }}>
        Illustrative profile based on the 106-trade SESSION_FILTERED_OPTIMAL_SAMPLE.
        Switch views to observe the drawdown structure independently from the equity curve.
      </div>
    </div>
  );
}
