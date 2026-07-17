"use client";

/**
 * KmsDashboard — the Systemic Analytics Grid.
 *   1. Triage Queue — novel + relapsed anomalies awaiting Strategist action.
 *   2. Active Validation Matrix — deployments currently surviving OOS.
 *   3. Alpha Containment Scale — contained ÷ (contained + relapsed). Below 80%
 *      the accent shifts red: severe infrastructure degradation.
 * All numerics render in monospace on a fixed grid — no visual jitter.
 */

import { toKmsStatus } from "@/lib/kms";

interface DashIssue {
  status: string;
  kms_status?: string | null;
  oos_sessions?: number;
  oos_sessions_required?: number;
}

export default function KmsDashboard({ issues }: { issues: DashIssue[] }) {
  let triage = 0, oos = 0, baseline = 0, relapsed = 0, queued = 0;
  let oosProg = 0;

  for (const i of issues) {
    const k = toKmsStatus(i.kms_status, i.status);
    if (k === "TRIAGE_PENDING") triage++;
    else if (k === "RELAPSED") { triage++; relapsed++; }
    else if (k === "TOOL_QUEUED") queued++;
    else if (k === "OOS_VALIDATION") {
      oos++;
      oosProg += Math.min(1, (i.oos_sessions ?? 0) / Math.max(1, i.oos_sessions_required ?? 15));
    }
    else if (k === "BASELINE_RESTORED") baseline++;
  }

  const denom       = baseline + relapsed;
  const containment = denom > 0 ? Math.round((baseline / denom) * 1000) / 10 : 100;
  const degraded    = containment < 80;
  const containCol  = degraded ? "#f03a57" : containment < 92 ? "#f0a030" : "#00cc7a";
  const avgOosPct   = oos > 0 ? Math.round((oosProg / oos) * 100) : 0;

  const tile: React.CSSProperties = {
    flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 8,
    background: "var(--raised,#0f1e2e)", border: "1px solid var(--line,rgba(255,255,255,0.06))",
  };
  const lab: React.CSSProperties = {
    fontSize: 7.5, letterSpacing: "0.11em", color: "var(--ink-2,#5a7490)",
    fontFamily: "var(--font-mono)", fontWeight: 700, display: "block", marginBottom: 4,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  };

  return (
    <div style={{ display: "flex", gap: 6, padding: "10px 11px 2px" }}>
      <div style={{ ...tile, borderColor: triage > 0 ? "rgba(240,160,48,0.3)" : undefined }}>
        <span style={lab}>TRIAGE QUEUE</span>
        <span className="mono" style={{ fontSize: 17, fontWeight: 700, lineHeight: 1, color: triage > 0 ? "#f0a030" : "var(--ink-1,#9ab0c8)" }}>
          {triage}
        </span>
        {relapsed > 0 && (
          <span className="mono" style={{ fontSize: 8.5, color: "#f03a57", marginLeft: 6 }}>
            {relapsed} relapsed
          </span>
        )}
      </div>

      <div style={tile}>
        <span style={lab}>OOS VALIDATION</span>
        <span className="mono" style={{ fontSize: 17, fontWeight: 700, lineHeight: 1, color: "#00b4ff" }}>
          {oos}
        </span>
        <span className="mono" style={{ fontSize: 8.5, color: "var(--ink-2,#5a7490)", marginLeft: 6 }}>
          {queued > 0 ? `+${queued} queued` : oos > 0 ? `${avgOosPct}% avg` : "idle"}
        </span>
      </div>

      <div style={{ ...tile, borderColor: degraded ? "rgba(240,58,87,0.45)" : undefined, background: degraded ? "rgba(240,58,87,0.06)" : tile.background }}>
        <span style={{ ...lab, color: degraded ? "#f03a57" : lab.color }}>ALPHA CONTAINMENT</span>
        <span className="mono" style={{ fontSize: 17, fontWeight: 700, lineHeight: 1, color: containCol }}>
          {containment.toFixed(1)}%
        </span>
        {degraded && (
          <span className="mono" style={{ fontSize: 8, color: "#f03a57", marginLeft: 6, fontWeight: 700 }}>
            DEGRADED
          </span>
        )}
      </div>
    </div>
  );
}
