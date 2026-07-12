"use client";

import { useState, useEffect, useCallback } from "react";

interface Strategy {
  issue_id:              string;
  title:                 string;
  priority:              number;
  solution_id:           string;
  solution_description:  string;
  solution_proposed_by:  string;
  solution_endorsements: number;
  solution_disregards:   number;
  solution_created_at:   string;
}

const P_LABEL = ["DIRE", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;
const P_COLOR = ["#f03a57", "#f03a57", "#f0a030", "#eab308", "#4d9cf5", "#8ea3be"] as const;
const P_BG    = [
  "rgba(240,58,87,0.16)",  "rgba(240,58,87,0.10)",
  "rgba(240,160,48,0.13)", "rgba(234,179,8,0.11)",
  "rgba(77,156,245,0.11)", "rgba(142,163,190,0.10)",
] as const;

export default function OngoingStrategy() {
  const [strategies,  setStrategies]  = useState<Strategy[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [collapsed,   setCollapsed]   = useState(false);
  const [endorsed,    setEndorsed]    = useState<Set<string>>(new Set());
  const [disregarded, setDisregarded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/session/issues");
      if (!r.ok) { setError("Failed to load strategies"); return; }
      const issues: any[] = await r.json();
      const active: Strategy[] = issues
        .filter(i => i.solution_id && i.solution_description)
        .map(i => ({
          issue_id:              i.issue_id,
          title:                 i.title,
          priority:              i.priority,
          solution_id:           i.solution_id,
          solution_description:  i.solution_description,
          solution_proposed_by:  i.solution_proposed_by ?? "",
          solution_endorsements: i.solution_endorsements ?? 0,
          solution_disregards:   i.solution_disregards ?? 0,
          solution_created_at:   i.solution_created_at ?? "",
        }))
        .sort((a, b) =>
          a.priority - b.priority ||
          b.solution_endorsements - a.solution_endorsements ||
          new Date(a.solution_created_at).getTime() - new Date(b.solution_created_at).getTime()
        );
      setStrategies(active);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(issueId: string, solutionId: string, action: "endorse" | "disregard") {
    if (action === "endorse") setEndorsed(prev => new Set([...prev, solutionId]));
    else setDisregarded(prev => new Set([...prev, solutionId]));

    const r = await fetch(`/api/session/issues/${issueId}/solution/${action}`, { method: "POST" });
    if (!r.ok) {
      if (action === "endorse")    setEndorsed(prev => { const s = new Set(prev); s.delete(solutionId); return s; });
      else setDisregarded(prev => { const s = new Set(prev); s.delete(solutionId); return s; });
    } else {
      load();
    }
  }

  if (strategies.length === 0 && !loading && !error) return null;

  return (
    <div
      style={{
        border:       "1px solid var(--line,rgba(255,255,255,0.06))",
        borderRadius: "8px",
        overflow:     "hidden",
        background:   "var(--sub,#07101c)",
      }}
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed(v => !v)}
        style={{
          width:        "100%",
          background:   "none",
          border:       "none",
          cursor:       "pointer",
          display:      "flex",
          alignItems:   "center",
          gap:          "8px",
          padding:      "10px 13px",
          textAlign:    "left",
        }}
      >
        <span style={{ fontSize: "10px", fontWeight: 800, color: "#00cc7a", letterSpacing: "0.6px" }}>
          ON-GOING STRATEGY
        </span>
        <span
          style={{
            padding:      "1px 6px",
            borderRadius: "8px",
            fontSize:     "9px",
            fontWeight:   700,
            background:   "rgba(0,204,122,0.12)",
            color:        "#00cc7a",
          }}
        >
          {loading ? "…" : strategies.length}
        </span>
        <span style={{ marginLeft: "auto", color: "var(--ink-2,#5a7490)", fontSize: "11px" }}>
          {collapsed ? "▸" : "▾"}
        </span>
      </button>

      {!collapsed && (
        <div style={{ borderTop: "1px solid var(--line,rgba(255,255,255,0.06))" }}>
          {error && (
            <div style={{ padding: "6px 13px", fontSize: "11px", color: "#f03a57" }}>{error}</div>
          )}

          {strategies.map((s, idx) => {
            const e       = endorsed.has(s.solution_id);
            const d       = disregarded.has(s.solution_id);
            const actioned = e || d;
            return (
              <div
                key={s.solution_id}
                style={{
                  padding:      "9px 13px",
                  borderTop:    idx === 0 ? "none" : "1px solid var(--line,rgba(255,255,255,0.06))",
                  display:      "flex",
                  flexDirection: "column",
                  gap:          "5px",
                }}
              >
                {/* Priority badge + issue title */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      padding:      "1px 5px",
                      borderRadius: "3px",
                      fontSize:     "9px",
                      fontWeight:   700,
                      background:   P_BG[s.priority],
                      color:        P_COLOR[s.priority],
                      flexShrink:   0,
                    }}
                  >
                    {P_LABEL[s.priority]}
                  </span>
                  <span
                    style={{
                      fontSize:     "11px",
                      fontWeight:   600,
                      color:        "var(--fg)",
                      overflow:     "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace:   "nowrap",
                      flex:         1,
                    }}
                  >
                    {s.title}
                  </span>
                </div>

                {/* Strategy description */}
                <p
                  style={{
                    margin:     0,
                    fontSize:   "11px",
                    color:      "var(--ink-1,#9ab0c8)",
                    lineHeight: 1.5,
                  }}
                >
                  {s.solution_description.length > 140
                    ? s.solution_description.slice(0, 140) + "…"
                    : s.solution_description}
                </p>

                {/* Endorse / Disregard row */}
                <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                  <button
                    onClick={() => !actioned && act(s.issue_id, s.solution_id, "endorse")}
                    disabled={actioned}
                    title={e ? "You've endorsed this strategy" : "Endorse this strategy"}
                    style={{
                      display:    "inline-flex",
                      alignItems: "center",
                      gap:        "3px",
                      padding:    "2px 8px",
                      borderRadius: "4px",
                      border:     `1px solid ${e ? "rgba(0,204,122,0.5)" : "rgba(0,204,122,0.2)"}`,
                      background: e ? "rgba(0,204,122,0.15)" : "rgba(0,204,122,0.05)",
                      color:      "#00cc7a",
                      fontSize:   "10px",
                      fontWeight: 700,
                      cursor:     actioned ? "default" : "pointer",
                      opacity:    d ? 0.4 : 1,
                    }}
                  >
                    ✓ Endorse {s.solution_endorsements > 0 ? s.solution_endorsements : ""}
                  </button>
                  <button
                    onClick={() => !actioned && act(s.issue_id, s.solution_id, "disregard")}
                    disabled={actioned}
                    title={d ? "You've disregarded this strategy" : "Disregard this strategy"}
                    style={{
                      display:    "inline-flex",
                      alignItems: "center",
                      gap:        "3px",
                      padding:    "2px 8px",
                      borderRadius: "4px",
                      border:     `1px solid ${d ? "rgba(240,58,87,0.5)" : "rgba(240,58,87,0.2)"}`,
                      background: d ? "rgba(240,58,87,0.15)" : "rgba(240,58,87,0.05)",
                      color:      "#f03a57",
                      fontSize:   "10px",
                      fontWeight: 700,
                      cursor:     actioned ? "default" : "pointer",
                      opacity:    e ? 0.4 : 1,
                    }}
                  >
                    ✗ Disregard {s.solution_disregards > 0 ? s.solution_disregards : ""}
                  </button>
                  <button
                    onClick={load}
                    style={{
                      marginLeft:   "auto",
                      padding:      "2px 5px",
                      borderRadius: "4px",
                      border:       "none",
                      background:   "none",
                      color:        "var(--ink-2,#5a7490)",
                      fontSize:     "11px",
                      cursor:       "pointer",
                    }}
                    title="Refresh"
                  >
                    ↻
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
