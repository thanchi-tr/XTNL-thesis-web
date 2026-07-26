"use client";

/**
 * SafetyPlacard — a playful nod to the incident that founded the firm's
 * stop-loss discipline, styled like an industrial "days since last incident"
 * safety sign. Ticks a live day-count client-side from a fixed anchor date —
 * a real number, not a decorative placeholder.
 */

import { useEffect, useState } from "react";

const INCIDENT_MONTH = "June 2020";
const ANCHOR = new Date("2020-06-01T00:00:00+10:00").getTime();

export default function SafetyPlacard() {
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    const compute = () => setDays(Math.floor((Date.now() - ANCHOR) / 86_400_000));
    compute();
    const id = window.setInterval(compute, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className="mono"
      style={{
        display: "inline-flex", alignItems: "center", gap: 14,
        padding: "12px 20px", borderRadius: 10,
        background: "repeating-linear-gradient(135deg, rgba(240,160,48,0.08) 0 10px, rgba(240,160,48,0.04) 10px 20px), var(--card)",
        border: "1px solid rgba(240,160,48,0.35)",
        boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
      }}
      title={`Estimated — the exact date isn't recorded, only that it was ${INCIDENT_MONTH}.`}
    >
      <span aria-hidden className="xtnl-placard-pulse" style={{ fontSize: 20, lineHeight: 1, filter: "saturate(0.9)" }}>⚠️</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 8.5, letterSpacing: "0.14em", color: "var(--amber, #f0a030)", fontWeight: 700 }}>
          SAFETY RECORD · STOP-LOSS COMPLIANCE
        </span>
        <span style={{ fontSize: 18, fontWeight: 800, color: "var(--ink-0)", letterSpacing: "-0.01em" }}>
          {days === null ? "—" : days.toLocaleString()} days
        </span>
        <span style={{ fontSize: 8, letterSpacing: "0.06em", color: "var(--ink-3)" }}>
          since the last trade placed without one · est. {INCIDENT_MONTH}
        </span>
      </div>
    </div>
  );
}
