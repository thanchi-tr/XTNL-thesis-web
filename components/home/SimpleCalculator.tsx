"use client";

import { useState } from "react";

const SCENARIOS = {
  conservative: { annualPct: 0.22, label: "Conservative",  color: "var(--blue)"  },
  expected:     { annualPct: 0.52, label: "Expected",       color: "var(--green)" },
  optimistic:   { annualPct: 0.88, label: "Optimistic",     color: "var(--amber)" },
};

function compound(capital: number, ratePerYear: number, years: number) {
  return capital * Math.pow(1 + ratePerYear, years);
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

const CAPITAL_OPTIONS = [10_000, 25_000, 50_000, 100_000, 250_000, 500_000];

export default function SimpleCalculator() {
  const [capital, setCapital] = useState(50_000);
  const [years,   setYears]   = useState(5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Controls */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 20,
        }}
      >
        {/* Capital selector */}
        <div
          className="card"
          style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="label-xs">Starting Capital</span>
            <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: "var(--green)" }}>
              {fmt(capital)}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {CAPITAL_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setCapital(opt)}
                className="btn btn-ghost"
                style={{
                  fontSize: 11,
                  padding: "5px 12px",
                  borderColor: capital === opt ? "var(--green)" : undefined,
                  color: capital === opt ? "var(--green)" : undefined,
                }}
              >
                {fmt(opt)}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={5000}
            max={500_000}
            step={5000}
            value={capital}
            onChange={(e) => setCapital(Number(e.target.value))}
          />
        </div>

        {/* Year selector */}
        <div
          className="card"
          style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="label-xs">Time Horizon</span>
            <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: "var(--green)" }}>
              {years} {years === 1 ? "year" : "years"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[1, 2, 3, 5, 7, 10].map((y) => (
              <button
                key={y}
                onClick={() => setYears(y)}
                className="btn btn-ghost"
                style={{
                  fontSize: 11,
                  padding: "5px 12px",
                  flex: 1,
                  borderColor: years === y ? "var(--green)" : undefined,
                  color: years === y ? "var(--green)" : undefined,
                }}
              >
                {y}yr
              </button>
            ))}
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Results */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        {Object.entries(SCENARIOS).map(([key, { annualPct, label, color }]) => {
          const final = compound(capital, annualPct, years);
          const gain  = final - capital;
          const mult  = final / capital;
          return (
            <div
              key={key}
              className="card card-hover"
              style={{ padding: 24, display: "flex", flexDirection: "column", gap: 10 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="label-xs">{label}</span>
                <span
                  className="mono"
                  style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.08em" }}
                >
                  +{(annualPct * 100).toFixed(0)}%/yr
                </span>
              </div>
              <p className="mono" style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1 }}>
                {fmt(final)}
              </p>
              <div style={{ height: 1, background: "var(--line)" }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "var(--ink-2)" }}>
                  Gain: <span style={{ color: "var(--ink-1)" }}>{fmt(gain)}</span>
                </span>
                <span style={{ fontSize: 12, color: "var(--ink-2)" }}>
                  {mult.toFixed(1)}× initial
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 11, color: "var(--ink-3)", lineHeight: 1.6, textAlign: "center" }}>
        Conservative assumes 22%/yr net · Expected assumes 52%/yr net · Optimistic assumes 88%/yr net.
        Based on live statistical data after 47% ATO tax drag and operator efficiency adjustments.
        These are projections, not guarantees. Past performance does not guarantee future results.
      </p>
    </div>
  );
}
