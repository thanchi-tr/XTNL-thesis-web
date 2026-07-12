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
const P_COLOR = ["#f03a57", "#f03a57", "#f0a030", "#eab308", "#4d9cf5", "var(--ink-2,#5a7490)"] as const;
const P_BG    = [
  "rgba(240,58,87,0.15)",  "rgba(240,58,87,0.10)",
  "rgba(240,160,48,0.12)", "rgba(234,179,8,0.10)",
  "rgba(77,156,245,0.10)", "rgba(90,116,144,0.10)",
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
      if (action === "endorse") setEndorsed(prev => { const s = new Set(prev); s.delete(solutionId); return s; });
      else setDisregarded(prev => { const s = new Set(prev); s.delete(solutionId); return s; });
    } else {
      load();
    }
  }

  if (strategies.length === 0 && !loading && !error) return null;

  return (
    <div style={{ border: "1px solid var(--line,rgba(255,255,255,0.06))", borderRadius: 8, overflow: "hidden", background: "var(--sub,#07101c)" }}>

      {/* Header */}
      <button
        onClick={() => setCollapsed(v => !v)}
        style={{
          width: "100%", background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 13px", textAlign: "left",
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 800, color: "#00cc7a", letterSpacing: "0.6px" }}>
          ON-GOING STRATEGY
        </span>
        <span style={{ padding: "1px 6px", borderRadius: 8, fontSize: 9, fontWeight: 700, background: "rgba(0,204,122,0.12)", color: "#00cc7a" }}>
          {loading ? "…" : strategies.length}
        </span>
        <button
          onClick={e => { e.stopPropagation(); load(); }}
          disabled={loading}
          title="Refresh"
          style={{
            marginLeft: "auto", marginRight: 4,
            background: "none", border: "none",
            color: "var(--ink-2,#5a7490)", fontSize: 13,
            cursor: loading ? "default" : "pointer", lineHeight: 1, padding: 0,
          }}
        >
          ↻
        </button>
        <span style={{ color: "var(--ink-2,#5a7490)", fontSize: 11 }}>
          {collapsed ? "▸" : "▾"}
        </span>
      </button>

      {!collapsed && (
        <div style={{ borderTop: "1px solid var(--line,rgba(255,255,255,0.06))" }}>
          {error && (
            <div style={{ padding: "6px 13px", fontSize: 11, color: "#f03a57" }}>{error}</div>
          )}

          {strategies.map((s, idx) => {
            const e        = endorsed.has(s.solution_id);
            const d        = disregarded.has(s.solution_id);
            const actioned = e || d;
            const dateStr  = s.solution_created_at
              ? new Date(s.solution_created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
              : "";

            return (
              <div
                key={s.solution_id}
                style={{
                  padding: "11px 13px",
                  borderTop: idx === 0 ? "none" : "1px solid var(--line,rgba(255,255,255,0.06))",
                  display: "flex", flexDirection: "column", gap: 8,
                }}
              >
                {/* Solution description — primary focus */}
                <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "var(--ink-0,#eef2f8)", lineHeight: 1.55 }}>
                  {s.solution_description}
                </p>

                {/* Context row: issue tag + proposer + date */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{
                    padding: "1px 5px", borderRadius: 3,
                    fontSize: 9, fontWeight: 700,
                    background: P_BG[s.priority], color: P_COLOR[s.priority],
                    flexShrink: 0,
                  }}>
                    {P_LABEL[s.priority]}
                  </span>
                  <span style={{
                    fontSize: 10, color: "var(--ink-2,#5a7490)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0,
                  }}>
                    {s.title}
                  </span>
                  {dateStr && (
                    <span style={{ fontSize: 9, color: "var(--ink-3,#2a3d52)", flexShrink: 0 }}>{dateStr}</span>
                  )}
                </div>

                {/* Endorse / Disregard */}
                <div style={{ display: "flex", gap: 5 }}>
                  <button
                    onClick={() => !actioned && act(s.issue_id, s.solution_id, "endorse")}
                    disabled={actioned}
                    title={e ? "Endorsed" : "Endorse this strategy"}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "3px 10px", borderRadius: 4,
                      border: `1px solid ${e ? "rgba(0,204,122,0.45)" : "rgba(0,204,122,0.2)"}`,
                      background: e ? "rgba(0,204,122,0.14)" : "rgba(0,204,122,0.05)",
                      color: "#00cc7a", fontSize: 10, fontWeight: 700,
                      cursor: actioned ? "default" : "pointer", opacity: d ? 0.38 : 1,
                    }}
                  >
                    ✓ Endorse{s.solution_endorsements > 0 ? ` · ${s.solution_endorsements}` : ""}
                  </button>
                  <button
                    onClick={() => !actioned && act(s.issue_id, s.solution_id, "disregard")}
                    disabled={actioned}
                    title={d ? "Disregarded" : "Disregard this strategy"}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "3px 10px", borderRadius: 4,
                      border: `1px solid ${d ? "rgba(240,58,87,0.45)" : "rgba(240,58,87,0.2)"}`,
                      background: d ? "rgba(240,58,87,0.14)" : "rgba(240,58,87,0.05)",
                      color: "#f03a57", fontSize: 10, fontWeight: 700,
                      cursor: actioned ? "default" : "pointer", opacity: e ? 0.38 : 1,
                    }}
                  >
                    ✗ Disregard{s.solution_disregards > 0 ? ` · ${s.solution_disregards}` : ""}
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
