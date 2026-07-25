"use client";

import { useState } from "react";
import type { FrictionReport } from "@/lib/frictionReport";

function StatPill({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 10px", borderRadius: 4, background: "var(--sub)", border: "1px solid var(--line)" }}>
      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "var(--ink-3)" }}>{label}</span>
      <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", fontWeight: 700, color: accent ?? "var(--ink-1)" }}>{value}</span>
    </div>
  );
}

function MetricRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
      <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{label}</span>
      <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", fontWeight: 600, color: accent ?? "var(--ink-1)" }}>{value}</span>
    </div>
  );
}

export default function FrictionPanel({ f }: { f: FrictionReport }) {
  const [metricsOpen, setMetricsOpen] = useState(false);
  const ratingColor = ({ ELITE: "var(--green)", "ON-PAR": "var(--amber)", "SUB-PAR": "var(--red)" } as const)[f.exec.label] ?? "var(--ink-1)";

  // Decay as a % of baseline SQN, not a raw decimal — a raw "0.19" reads as
  // negligible; "5.9%" (of the actual SQN it's measured against) reads as
  // the real severity. sqn<=0 means there's no edge left to decay *from*,
  // which is the worst possible state — that must map to maximum severity
  // (100%), not fall through to "0% decay" just because the division is
  // undefined. Clamped at 0 on the other end so a negative decay (stress
  // SQN came back higher than baseline) can't render as a confusing
  // negative percentage — it's already unambiguously in the healthy bucket
  // either way.
  const decayPct = f.edge.sqn > 0
    ? Math.max(0, (f.edge.decay / f.edge.sqn) * 100)
    : 100;
  const decayColor = decayPct < 10 ? "var(--green)" : decayPct < 25 ? "var(--amber)" : "var(--red)";

  // Profit Leakage is R given up to inefficiency — it's reported as 0 or
  // negative (e.g. "-0.00R", "-0.5R"), never positive. 0 (or effectively 0,
  // allowing for float noise like -0.00) is the *best* possible outcome and
  // must read as green, not the hardcoded red this used to always show
  // regardless of value.
  const leakageColor = f.exec.leakage >= -0.01
    ? "var(--green)"
    : f.exec.leakage >= -0.5
      ? "var(--amber)"
      : "var(--red)";

  /* section divider with label */
  const Divider = ({ label, color }: { label: string; color: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.12em", color, textTransform: "uppercase" as const, fontFamily: "var(--font-mono)", flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, ${color}40, transparent)` }} />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Header ───────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <p className="section-eyebrow" style={{ color: "var(--amber)", marginBottom: 5 }}>Pre-Session Mirror</p>
          <p style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "var(--ink-0)", letterSpacing: "-0.02em" }}>
            {f.state.mode}
          </p>
        </div>
        {f.ts && (
          <div style={{
            display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
            padding: "4px 9px", borderRadius: 4,
            border: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.03)",
          }}>
            <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden style={{ flexShrink: 0 }}>
              <circle cx="6" cy="6" r="4.5" stroke="var(--ink-3)" strokeWidth="1.2"/>
              <path d="M6 3.5V6l1.5 1.5" stroke="var(--ink-3)" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--ink-3)", letterSpacing: "0.02em" }}>
              {f.ts}
            </span>
          </div>
        )}
      </div>

      {/* ── Key stats strip ───────────────────────────── */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <StatPill label="Rating"  value={`${f.exec.rating} · ${f.exec.label}`} accent={ratingColor} />
        <StatPill label="Leakage" value={`${f.exec.leakage}R`}                 accent={leakageColor} />
        <StatPill label="Forgiven" value={`+${f.exec.forgiven}R`}              accent="var(--green)" />
        <StatPill label="SQN"     value={`${f.edge.sqn} / ${f.edge.stressSqn} stress`} accent="var(--green)" />
        <StatPill label="Decay"   value={`${decayPct.toFixed(1)}% · ${f.edge.decayLabel}`} accent={decayColor} />
        <StatPill label="Capture" value={`${f.exec.capture}%`}                 accent="var(--green)" />
      </div>

      {/* ══════════════════════════════════════════════
          PRIMARY FOCUS #1 — THE MIRROR
      ══════════════════════════════════════════════ */}
      <div>
        <Divider label="The Mirror · LLM Audit" color="var(--amber)" />
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderLeft: "3px solid var(--amber)", borderRadius: "0 6px 6px 0", overflow: "hidden" }}>

          {/* Review body — large, readable */}
          <div className="mirror-body">
            <span className="chip chip-amber" style={{ marginBottom: 14, display: "inline-block" }}>Radical Candor</span>
            <p style={{ margin: 0, fontSize: 14.5, color: "var(--ink-0)", lineHeight: 1.85, letterSpacing: "0.005em" }}>
              {f.mirror}
            </p>
          </div>

          {/* Flaws */}
          {f.flaws.length > 0 && (
            <div style={{ padding: "0 24px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
              {f.flaws.map((fl, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 12px", background: "var(--red-10)", border: "1px solid rgba(240,58,87,0.15)", borderRadius: 4 }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden>
                    <path d="M8 2L14 13H2L8 2Z" stroke="var(--red)" strokeWidth="1.2" strokeLinejoin="round"/>
                    <path d="M8 6.5v2.5M8 11h.01" stroke="var(--red)" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  <span style={{ fontSize: 11.5, color: "var(--red)", fontFamily: "var(--font-mono)", lineHeight: 1.6 }}>{fl}</span>
                </div>
              ))}
            </div>
          )}

          {/* Handover notes */}
          {f.handover && (
            <div className="mirror-handover" style={{ borderTop: "1px solid var(--line)" }}>
              <p style={{ margin: "0 0 6px", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.09em", color: "var(--ink-3)", textTransform: "uppercase" }}>Handover Notes</p>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.75 }}>{f.handover}</p>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          PRIMARY FOCUS #2 — FRICTION UPDATES
      ══════════════════════════════════════════════ */}
      <div>
        <Divider label="System Friction Updates" color="var(--red)" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {f.updates.map((u, i) => (
            <div key={i} style={{ display: "flex", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
              {/* Number badge */}
              <div style={{ width: 44, flexShrink: 0, background: "var(--sub)", borderRight: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--ink-3)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              {/* Rule text */}
              <div className="friction-rule-text">
                <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-0)", lineHeight: 1.75 }}>{u}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          SECONDARY — collapsible full metrics
      ══════════════════════════════════════════════ */}
      <button
        type="button"
        onClick={() => setMetricsOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none", cursor: "pointer", padding: "4px 0", color: "var(--ink-3)" }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden style={{ transition: "transform 0.2s", transform: metricsOpen ? "rotate(180deg)" : "none" }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "var(--ink-3)" }}>
          {metricsOpen ? "Hide" : "Show"} full metrics
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
      </button>

      {metricsOpen && (
        <div className="grid-3-col" style={{ marginTop: -10 }}>
          {/* System State */}
          <div className="card" style={{ padding: "12px 14px" }}>
            <span className="chip chip-amber" style={{ marginBottom: 10, display: "inline-block", fontSize: 9 }}>System State</span>
            <MetricRow label="Streak"     value={f.state.streak} />
            <MetricRow label="Injection"  value={f.state.injection} accent={f.state.locked ? "var(--red)" : "var(--green)"} />
            <MetricRow label="Status"     value={f.state.locked ? "LOCKED" : "UNLOCKED"} accent={f.state.locked ? "var(--red)" : "var(--green)"} />
            <MetricRow label="Scaling"    value={f.state.scaling} />
            <MetricRow label="Deployment" value={f.state.deployment} />
            {f.state.streakNote && <p style={{ marginTop: 8, fontSize: 10.5, color: "var(--ink-3)", fontStyle: "italic", lineHeight: 1.5 }}>{f.state.streakNote}</p>}
          </div>
          {/* Execution Truth */}
          <div className="card" style={{ padding: "12px 14px" }}>
            <span className="chip chip-blue" style={{ marginBottom: 10, display: "inline-block", fontSize: 9 }}>Execution</span>
            <MetricRow label="Rating"      value={String(f.exec.rating)} accent={ratingColor} />
            <MetricRow label="Leakage"     value={`${f.exec.leakage}R`}  accent={leakageColor} />
            <MetricRow label="Forgiven"    value={`+${f.exec.forgiven}R`} accent="var(--green)" />
            <MetricRow label="Lucky R"     value={`${f.exec.luckyR}R`}   accent="var(--ink-2)" />
            <MetricRow label="Capture"     value={`${f.exec.capture}%`}  accent="var(--green)" />
            <MetricRow label="Exemptions"  value={String(f.exec.exemptions)} accent="var(--amber)" />
          </div>
          {/* Probabilistic Edge */}
          <div className="card" style={{ padding: "12px 14px" }}>
            <span className="chip chip-green" style={{ marginBottom: 10, display: "inline-block", fontSize: 9 }}>Probabilistic Edge</span>
            <MetricRow label="System SQN"  value={String(f.edge.sqn)}       accent="var(--green)" />
            <MetricRow label="Stress SQN"  value={String(f.edge.stressSqn)} accent="var(--green)" />
            <MetricRow label="Edge Decay"  value={`${decayPct.toFixed(1)}%`} accent={decayColor} />
            <MetricRow label="Decay Label" value={f.edge.decayLabel}         accent={decayColor} />
            <MetricRow label="Target Risk" value={f.edge.risk}               accent="var(--ink-1)" />
          </div>
        </div>
      )}
    </div>
  );
}
