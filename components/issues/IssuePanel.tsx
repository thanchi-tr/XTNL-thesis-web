"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

/* ── Types ───────────────────────────────────────────────────── */
type IssueStatus = "open" | "in_progress" | "staging" | "archived";
type TabFilter   = "active" | "staging" | "archived";

interface ScratchedSolution {
  solution_id:  string;
  description:  string;
  proposed_by:  string;
  created_at:   string;
  scratched_at: string | null;
  scratched_by: string | null;
}

interface Issue {
  issue_id:               string;
  title:                  string;
  description:            string | null;
  reported_by:            string;
  reporter_role:          string | null;
  priority:               number;
  status:                 IssueStatus;
  raise_count:            number;
  reopen_count:           number;
  created_at:             string;
  staging_at:             string | null;
  staging_days_remaining: number | null;
  solution_id:            string | null;
  solution_description:   string | null;
  solution_proposed_by:   string | null;
  solution_created_at:    string | null;
  observed_week_1:        string | null;
  observed_week_2:        string | null;
  observed_week_3:        string | null;
  all_observed_at:        string | null;
  scratched_solutions:    ScratchedSolution[];
}

/* ── Priority config ─────────────────────────────────────────── */
const P_LABEL = ["DIRE", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;
const P_COLOR = ["#f03a57", "#f03a57", "#f0a030", "#eab308", "#4d9cf5", "#8ea3be"] as const;
const P_BG    = [
  "rgba(240,58,87,0.16)",  "rgba(240,58,87,0.10)",
  "rgba(240,160,48,0.13)", "rgba(234,179,8,0.11)",
  "rgba(77,156,245,0.11)", "rgba(142,163,190,0.10)",
] as const;

/* ── Helpers ─────────────────────────────────────────────────── */
function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 2)  return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function shortEmail(email: string): string {
  return email.split("@")[0] ?? email;
}

/* ── Observed-resolve checkbox ───────────────────────────────── */
function ObsBox({ week, checked, disabled, onCheck }: {
  week: 1 | 2 | 3; checked: boolean; disabled: boolean; onCheck: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCheck}
      disabled={disabled || checked}
      title={checked ? `Week ${week} observed` : disabled ? `Complete week ${week - 1} first` : `Mark week ${week} as resolved`}
      style={{
        display: "flex", alignItems: "center", gap: 4,
        padding: "4px 10px", borderRadius: 4,
        border: `1px solid ${checked ? "var(--green)" : "var(--line)"}`,
        background: checked ? "rgba(0,204,122,0.09)" : "var(--sub)",
        cursor: disabled || checked ? "not-allowed" : "pointer",
        color: checked ? "var(--green)" : disabled ? "var(--ink-4)" : "var(--ink-2)",
        fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
        opacity: disabled && !checked ? 0.5 : 1,
        transition: "all 0.12s",
      }}
    >
      {checked ? "☑" : "☐"} W{week}
    </button>
  );
}

/* ── Issue card ──────────────────────────────────────────────── */
function IssueCard({
  issue, expanded, canSolve, canRaise,
  onToggle, onRaise, onSolveClick, onObserve, onReopenClick, onScratch,
}: {
  issue:         Issue;
  expanded:      boolean;
  canSolve:      boolean;
  canRaise:      boolean;
  onToggle:      () => void;
  onRaise:       () => void;
  onSolveClick:  () => void;
  onObserve:     (week: 1 | 2 | 3) => void;
  onReopenClick: () => void;
  onScratch:     () => void;
}) {
  const [scratchedOpen, setScratchedOpen] = useState(false);

  const p          = Math.max(0, Math.min(5, issue.priority));
  const hasSol     = Boolean(issue.solution_id);
  const isStaging  = issue.status === "staging";
  const isArchived = issue.status === "archived";
  const canReopen  = isStaging || isArchived;

  const STATUS_COLOR: Record<IssueStatus, string> = {
    open:        "#4d9cf5",
    in_progress: "#f0a030",
    staging:     "#00cc7a",
    archived:    "var(--ink-4)",
  };
  const STATUS_LABEL: Record<IssueStatus, string> = {
    open:        "OPEN",
    in_progress: "IN PROGRESS",
    staging:     "STAGING",
    archived:    "ARCHIVED",
  };

  return (
    <div style={{
      borderRadius: 7, overflow: "hidden",
      border: "1px solid var(--line)",
      borderLeft: `3px solid ${P_COLOR[p]}`,
      background: "var(--card)",
      transition: "border-color 0.15s",
    }}>
      {/* ── Collapsed header ── */}
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%", padding: "11px 12px 11px 14px",
          display: "flex", alignItems: "center", gap: 10,
          background: "none", border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Badges row */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 5, marginBottom: 5 }}>
            {/* Priority */}
            <span className="mono" style={{
              fontSize: 9, fontWeight: 800, letterSpacing: "0.08em",
              color: P_COLOR[p], background: P_BG[p],
              border: `1px solid ${P_COLOR[p]}30`,
              padding: "2px 6px", borderRadius: 3,
              animation: p === 0 ? "ip-pulse 1.6s ease-in-out infinite" : undefined,
            }}>
              {p} · {P_LABEL[p]}
            </span>
            {/* Status */}
            <span className="mono" style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.07em",
              color: STATUS_COLOR[issue.status],
              background: `${STATUS_COLOR[issue.status]}14`,
              border: `1px solid ${STATUS_COLOR[issue.status]}35`,
              padding: "2px 6px", borderRadius: 3,
            }}>
              {STATUS_LABEL[issue.status]}
            </span>
            {issue.reopen_count > 0 && (
              <span className="mono" style={{ fontSize: 9, color: "#f0a030" }}>
                ↺{issue.reopen_count}
              </span>
            )}
          </div>
          {/* Title */}
          <div style={{
            fontSize: 12.5, fontWeight: 600, color: "var(--ink-0)",
            lineHeight: 1.3, marginBottom: 4,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {issue.title}
          </div>
          {/* Meta */}
          <div style={{ fontSize: 10, color: "var(--ink-4)", display: "flex", gap: 6, alignItems: "center" }}>
            <span>{shortEmail(issue.reported_by)}</span>
            {issue.reporter_role && <><span>·</span><span style={{ color: "var(--ink-5)" }}>{issue.reporter_role}</span></>}
            <span>·</span>
            <span>{timeAgo(issue.created_at)} ago</span>
          </div>
        </div>

        {/* Raise count */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 1, flexShrink: 0, minWidth: 28,
        }}>
          <span style={{ fontSize: 10, color: "var(--ink-4)" }}>↑</span>
          <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-2)" }}>
            {issue.raise_count}
          </span>
        </div>

        {/* Chevron */}
        <span style={{
          fontSize: 9, color: "var(--ink-4)", flexShrink: 0,
          transform: expanded ? "rotate(90deg)" : "none",
          transition: "transform 0.15s", marginLeft: 2,
        }}>▶</span>
      </button>

      {/* ── Expanded body ── */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--line)", padding: "14px 15px 15px" }}>

          {/* Description */}
          {issue.description && (
            <p style={{
              fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.7,
              marginBottom: 12, paddingBottom: 12,
              borderBottom: "1px solid var(--line)",
            }}>
              {issue.description}
            </p>
          )}

          {/* Raise */}
          {canRaise && !isArchived && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onRaise(); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "4px 11px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                border: "1px solid var(--line)", background: "var(--sub)",
                color: "var(--ink-3)", cursor: "pointer", marginBottom: 14,
                transition: "border-color 0.12s, color 0.12s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--ink-3)"; e.currentTarget.style.color = "var(--ink-1)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.color = "var(--ink-3)"; }}
            >
              ↑ Raise this issue
            </button>
          )}

          {/* ── Active Solution ── */}
          {hasSol ? (
            <div style={{
              background: "var(--sub)", borderRadius: 6, padding: "12px 13px",
              border: "1px solid var(--line)", marginBottom: 10,
            }}>
              {/* Solution header */}
              <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                <span className="mono" style={{
                  flex: 1, fontSize: 9, fontWeight: 800, letterSpacing: "0.09em", color: "var(--green)",
                }}>
                  PROPOSED SOLUTION
                </span>
                {canSolve && !isStaging && !isArchived && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onScratch(); }}
                    title="Scratch this solution — moves it to history"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                      border: "1px solid rgba(240,58,87,0.35)",
                      background: "rgba(240,58,87,0.07)",
                      color: "#f03a57", cursor: "pointer", transition: "all 0.12s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(240,58,87,0.14)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(240,58,87,0.07)"; }}
                  >
                    ✗ Scratch
                  </button>
                )}
              </div>

              {/* Solution text */}
              <p style={{ fontSize: 12.5, color: "var(--ink-1)", lineHeight: 1.65, marginBottom: 8 }}>
                {issue.solution_description}
              </p>
              <div style={{ fontSize: 10, color: "var(--ink-4)", marginBottom: 11 }}>
                {shortEmail(issue.solution_proposed_by ?? "")}
                {issue.solution_created_at && <> · {timeAgo(issue.solution_created_at)} ago</>}
              </div>

              {/* Observed-resolve */}
              <div className="mono" style={{
                fontSize: 9, fontWeight: 700, letterSpacing: "0.07em",
                color: "var(--ink-3)", marginBottom: 6,
              }}>
                OBSERVED RESOLVE
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <ObsBox week={1} checked={Boolean(issue.observed_week_1)}
                  disabled={!canSolve || Boolean(issue.observed_week_1)}
                  onCheck={() => onObserve(1)} />
                <ObsBox week={2} checked={Boolean(issue.observed_week_2)}
                  disabled={!canSolve || !issue.observed_week_1 || Boolean(issue.observed_week_2)}
                  onCheck={() => onObserve(2)} />
                <ObsBox week={3} checked={Boolean(issue.observed_week_3)}
                  disabled={!canSolve || !issue.observed_week_2 || Boolean(issue.observed_week_3)}
                  onCheck={() => onObserve(3)} />
              </div>

              {/* Staging countdown */}
              {isStaging && issue.staging_days_remaining !== null && (
                <div style={{ marginTop: 10, fontSize: 11, color: "var(--green)", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />
                  Staging · {issue.staging_days_remaining}d until archive
                </div>
              )}
            </div>
          ) : canSolve && !isStaging && !isArchived ? (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onSolveClick(); }}
              style={{
                width: "100%", padding: "8px 0",
                border: "1px dashed rgba(0,204,122,0.4)", borderRadius: 6,
                background: "rgba(0,204,122,0.04)",
                color: "var(--green)", fontSize: 12, fontWeight: 600,
                cursor: "pointer", marginBottom: 10, transition: "background 0.12s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,204,122,0.09)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,204,122,0.04)"; }}
            >
              + Propose Solution
            </button>
          ) : !hasSol && !canSolve ? (
            <div style={{
              fontSize: 11.5, color: "var(--ink-4)", fontStyle: "italic",
              marginBottom: 10, padding: "8px 0",
            }}>
              Awaiting strategist solution.
            </div>
          ) : null}

          {/* ── Scratched solutions toggle ── */}
          {issue.scratched_solutions.length > 0 && (
            <div style={{ marginTop: hasSol ? 4 : 0, marginBottom: 10 }}>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setScratchedOpen(o => !o); }}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--ink-4)", fontSize: 11, padding: "3px 0",
                  transition: "color 0.12s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--ink-2)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--ink-4)"; }}
              >
                <span style={{
                  display: "inline-block", fontSize: 8,
                  transform: scratchedOpen ? "rotate(90deg)" : "none",
                  transition: "transform 0.15s",
                }}>▶</span>
                <span>{issue.scratched_solutions.length} scratched solution{issue.scratched_solutions.length !== 1 ? "s" : ""}</span>
              </button>

              {scratchedOpen && (
                <div style={{ marginTop: 7, display: "flex", flexDirection: "column", gap: 6, paddingLeft: 2 }}>
                  {issue.scratched_solutions.map(sol => (
                    <div key={sol.solution_id} style={{
                      borderRadius: 5, padding: "9px 11px",
                      background: "var(--sub)", opacity: 0.65,
                      borderLeft: "2px solid var(--line)",
                    }}>
                      <p style={{
                        fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.6,
                        marginBottom: 5, textDecoration: "line-through",
                        textDecorationColor: "var(--ink-4)",
                      }}>
                        {sol.description}
                      </p>
                      <div style={{ fontSize: 9.5, color: "var(--ink-5)", display: "flex", gap: 6 }}>
                        <span>by {shortEmail(sol.proposed_by)}</span>
                        {sol.scratched_at && <><span>·</span><span>scratched {timeAgo(sol.scratched_at)} ago</span></>}
                        {sol.scratched_by && sol.scratched_by !== sol.proposed_by && (
                          <><span>·</span><span>by {shortEmail(sol.scratched_by)}</span></>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reopen */}
          {canReopen && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onReopenClick(); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "5px 12px", borderRadius: 5, fontSize: 11, fontWeight: 600,
                border: "1px solid rgba(240,160,48,0.45)",
                background: "rgba(240,160,48,0.07)",
                color: "#f0a030", cursor: "pointer", transition: "background 0.12s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(240,160,48,0.14)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(240,160,48,0.07)"; }}
            >
              ↺ Reopen · escalates priority
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   IssuePanel — floating FAB + slide-in panel
══════════════════════════════════════════════════════════════ */
export default function IssuePanel() {
  const { data: session } = useSession();
  const roles: string[]   = (session as any)?.roles ?? [];
  const userEmail: string = (session as any)?.userEmail ?? "";

  const canReport = roles.some(r => ["operator", "analyst", "strategist", "fund_manager"].includes(r));
  const canSolve  = roles.some(r => ["strategist", "fund_manager"].includes(r));
  const canRaise  = canReport;

  const [open,       setOpen]       = useState(false);
  const [tab,        setTab]        = useState<TabFilter>("active");
  const [issues,     setIssues]     = useState<Issue[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [apiError,   setApiError]   = useState<string | null>(null);

  /* Create form */
  const [creating,    setCreating]    = useState(false);
  const [newTitle,    setNewTitle]    = useState("");
  const [newDesc,     setNewDesc]     = useState("");
  const [newPriority, setNewPriority] = useState(3);
  const [submitting,  setSubmitting]  = useState(false);

  /* Solution form */
  const [solvingId,    setSolvingId]    = useState<string | null>(null);
  const [solutionText, setSolutionText] = useState("");

  /* Reopen form */
  const [reopenId,     setReopenId]     = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState("");

  /* ── API helper ───────────────────────────────────────── */
  async function callApi(url: string, opts: RequestInit): Promise<string | null> {
    try {
      const r = await fetch(url, opts);
      if (r.ok) return null;
      let msg = `HTTP ${r.status}`;
      try { const b = await r.json(); if (b?.error) msg = `${r.status}: ${b.error}`; } catch { /* ignore */ }
      console.error("[IssuePanel]", url, msg);
      return msg;
    } catch (e) {
      return e instanceof Error ? e.message : "Network error";
    }
  }

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const r = await fetch("/api/session/issues");
      if (r.ok) {
        setIssues(await r.json());
      } else {
        let msg = `Could not load issues (HTTP ${r.status})`;
        try { const b = await r.json(); if (b?.error) msg = b.error; } catch { /* ignore */ }
        setApiError(msg);
      }
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (open) fetchIssues(); }, [open, fetchIssues]);

  /* Counts */
  const activeCount   = issues.filter(i => i.status === "open" || i.status === "in_progress").length;
  const stagingCount  = issues.filter(i => i.status === "staging").length;
  const archivedCount = issues.filter(i => i.status === "archived").length;
  const badgeCount    = activeCount + stagingCount;

  const filtered = issues.filter(i => {
    if (tab === "active")   return i.status === "open" || i.status === "in_progress";
    if (tab === "staging")  return i.status === "staging";
    if (tab === "archived") return i.status === "archived";
    return true;
  });

  /* ── Actions ──────────────────────────────────────────── */
  async function createIssue() {
    if (!newTitle.trim() || submitting) return;
    setSubmitting(true); setApiError(null);
    const err = await callApi("/api/session/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), description: newDesc.trim() || null, priority: newPriority }),
    });
    setSubmitting(false);
    if (err) { setApiError(`Failed to report: ${err}`); return; }
    setCreating(false); setNewTitle(""); setNewDesc(""); setNewPriority(3);
    fetchIssues();
  }

  async function raiseIssue(id: string) {
    const err = await callApi(`/api/session/issues/${id}/raise`, { method: "POST" });
    if (err) setApiError(`Failed to raise: ${err}`);
    else fetchIssues();
  }

  async function addSolution(id: string) {
    if (!solutionText.trim() || submitting) return;
    setSubmitting(true); setApiError(null);
    const err = await callApi(`/api/session/issues/${id}/solution`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: solutionText.trim() }),
    });
    setSubmitting(false);
    if (err) { setApiError(`Failed to submit solution: ${err}`); return; }
    setSolvingId(null); setSolutionText("");
    fetchIssues();
  }

  async function scratchSolution(id: string) {
    const err = await callApi(`/api/session/issues/${id}/solution`, { method: "DELETE" });
    if (err) setApiError(`Failed to scratch: ${err}`);
    else fetchIssues();
  }

  async function markObserved(id: string, week: 1 | 2 | 3) {
    const err = await callApi(`/api/session/issues/${id}/observe`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week }),
    });
    if (err) setApiError(`Failed to mark week ${week}: ${err}`);
    else fetchIssues();
  }

  async function reopenIssue(id: string) {
    const err = await callApi(`/api/session/issues/${id}/reopen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reopenReason.trim() || null }),
    });
    if (err) { setApiError(`Failed to reopen: ${err}`); return; }
    setReopenId(null); setReopenReason("");
    fetchIssues();
  }

  if (!session) return null;

  const TABS: { id: TabFilter; label: string; count: number }[] = [
    { id: "active",   label: "ACTIVE",   count: activeCount   },
    { id: "staging",  label: "STAGING",  count: stagingCount  },
    { id: "archived", label: "ARCHIVED", count: archivedCount },
  ];

  /* ── Inline form styles ───────────────────────────────── */
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 10px",
    background: "var(--sub)", border: "1px solid var(--line)",
    borderRadius: 5, color: "var(--ink-0)", fontSize: 12.5,
    outline: "none", boxSizing: "border-box",
  };

  return (
    <>
      <style>{`
        @keyframes ip-pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }
        @keyframes ip-slide  { from { transform:translateX(100%); opacity:0 } to { transform:translateX(0); opacity:1 } }
        .ip-input:focus { border-color: var(--green) !important; }
      `}</style>

      {/* ── FAB ─────────────────────────────────────────── */}
      <button
        type="button"
        aria-label="Issue tracker"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 900,
          width: 50, height: 50, borderRadius: "50%",
          background: "var(--green)", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px rgba(0,204,122,0.4)",
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = "0 6px 26px rgba(0,204,122,0.55)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)";   e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,204,122,0.4)"; }}
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <path d="M4 2v16M4 2h10l-2 4 2 4H4" stroke="#001a0e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {badgeCount > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4,
            background: "#f03a57", color: "#fff",
            borderRadius: "50%", minWidth: 18, height: 18,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 800, border: "2px solid var(--canvas)",
            fontFamily: "var(--font-mono)",
          }}>
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </button>

      {/* ── Panel ───────────────────────────────────────── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: "absolute", top: 0, right: 0, bottom: 0,
              width: "min(460px, 100vw)",
              background: "var(--canvas)",
              borderLeft: "1px solid var(--line)",
              display: "flex", flexDirection: "column",
              animation: "ip-slide 0.2s ease-out",
            }}
          >
            {/* Error banner */}
            {apiError && (
              <div style={{
                background: "rgba(240,58,87,0.1)", borderBottom: "1px solid rgba(240,58,87,0.3)",
                padding: "8px 14px", display: "flex", alignItems: "flex-start", gap: 8,
                flexShrink: 0,
              }}>
                <span style={{ color: "#f03a57", fontSize: 13, flexShrink: 0 }}>⚠</span>
                <span style={{ flex: 1, fontSize: 11.5, color: "#f03a57", lineHeight: 1.45 }}>{apiError}</span>
                <button type="button" onClick={() => setApiError(null)}
                  style={{ background: "none", border: "none", color: "#f03a57", cursor: "pointer", fontSize: 14, padding: 0, flexShrink: 0 }}>
                  ✕
                </button>
              </div>
            )}

            {/* Header */}
            <div style={{ padding: "16px 18px 0", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <div className="mono" style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", color: "var(--green)", marginBottom: 3 }}>
                    ISSUE TRACKER
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                    {shortEmail(userEmail)}
                    {roles[0] && <span style={{ color: "var(--ink-5)" }}> · {roles[0]}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    background: "none", border: "1px solid var(--line)",
                    borderRadius: 5, padding: "4px 10px", cursor: "pointer",
                    color: "var(--ink-4)", fontSize: 10, transition: "border-color 0.12s, color 0.12s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--line-hi)"; e.currentTarget.style.color = "var(--ink-2)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--line)";    e.currentTarget.style.color = "var(--ink-4)"; }}
                >
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                    <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span className="mono" style={{ letterSpacing: "0.08em" }}>ESC</span>
                </button>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex" }}>
                {TABS.map(t => (
                  <button key={t.id} type="button" onClick={() => setTab(t.id)}
                    style={{
                      padding: "7px 14px", border: "none", background: "none",
                      borderBottom: `2px solid ${tab === t.id ? "var(--green)" : "transparent"}`,
                      marginBottom: -1,
                      color: tab === t.id ? "var(--ink-0)" : "var(--ink-4)",
                      fontSize: 10.5, fontWeight: tab === t.id ? 700 : 400,
                      letterSpacing: "0.07em", cursor: "pointer",
                      transition: "color 0.12s, border-color 0.12s",
                      display: "flex", alignItems: "center", gap: 5,
                    }}
                  >
                    <span className="mono">{t.label}</span>
                    {t.count > 0 && (
                      <span style={{
                        background: tab === t.id ? "var(--green)" : "rgba(142,163,190,0.15)",
                        color: tab === t.id ? "#001a0e" : "var(--ink-4)",
                        borderRadius: 10, padding: "0 5px", fontSize: 9, fontWeight: 800,
                        fontFamily: "var(--font-mono)", minWidth: 16, textAlign: "center",
                      }}>
                        {t.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Issue list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 0" }}>
              {loading ? (
                <div style={{ textAlign: "center", color: "var(--ink-4)", fontSize: 12, padding: "40px 0" }}>
                  Loading…
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0" }}>
                  <div style={{ fontSize: 22, marginBottom: 8, opacity: 0.4 }}>
                    {tab === "active" ? "✓" : tab === "staging" ? "⧖" : "▣"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-4)" }}>
                    {tab === "active"   ? "No active issues" : ""}
                    {tab === "staging"  ? "Nothing in staging" : ""}
                    {tab === "archived" ? "Archive is empty" : ""}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 4 }}>
                  {filtered.map(issue => (
                    <IssueCard
                      key={issue.issue_id}
                      issue={issue}
                      expanded={expandedId === issue.issue_id}
                      canSolve={canSolve}
                      canRaise={canRaise}
                      onToggle={() => {
                        setExpandedId(prev => prev === issue.issue_id ? null : issue.issue_id);
                        setSolvingId(null); setReopenId(null);
                      }}
                      onRaise={() => raiseIssue(issue.issue_id)}
                      onSolveClick={() => { setSolvingId(issue.issue_id); setSolutionText(""); setReopenId(null); }}
                      onObserve={week => markObserved(issue.issue_id, week)}
                      onReopenClick={() => { setReopenId(issue.issue_id); setReopenReason(""); setSolvingId(null); }}
                      onScratch={() => scratchSolution(issue.issue_id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer forms */}
            <div style={{ padding: "12px 14px 16px", borderTop: "1px solid var(--line)", flexShrink: 0 }}>

              {/* Solve form */}
              {solvingId && (
                <div style={{
                  background: "var(--card)", border: "1px solid var(--line)",
                  borderRadius: 7, padding: "13px", marginBottom: 10,
                }}>
                  <div className="mono" style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "var(--green)", marginBottom: 9 }}>
                    PROPOSE SOLUTION
                  </div>
                  <textarea
                    className="ip-input"
                    value={solutionText}
                    onChange={e => setSolutionText(e.target.value)}
                    placeholder="Describe the proposed fix…"
                    rows={3}
                    style={{ ...inputStyle, resize: "vertical", marginBottom: 8 }}
                  />
                  <div style={{ display: "flex", gap: 7 }}>
                    <button type="button" onClick={() => addSolution(solvingId)}
                      disabled={!solutionText.trim() || submitting}
                      style={{
                        flex: 1, padding: "7px 0", borderRadius: 5, border: "none",
                        background: "var(--green)", color: "#001a0e", fontSize: 12, fontWeight: 700,
                        cursor: solutionText.trim() && !submitting ? "pointer" : "not-allowed",
                        opacity: solutionText.trim() && !submitting ? 1 : 0.5,
                      }}>
                      {submitting ? "Submitting…" : "Submit Solution"}
                    </button>
                    <button type="button" onClick={() => setSolvingId(null)}
                      style={{ padding: "7px 13px", borderRadius: 5, border: "1px solid var(--line)", background: "none", color: "var(--ink-3)", fontSize: 12, cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Reopen form */}
              {reopenId && (
                <div style={{
                  background: "var(--card)", border: "1px solid rgba(240,160,48,0.35)",
                  borderRadius: 7, padding: "13px", marginBottom: 10,
                }}>
                  <div className="mono" style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "#f0a030", marginBottom: 9 }}>
                    REOPEN · escalates priority by 1
                  </div>
                  <textarea
                    className="ip-input"
                    value={reopenReason}
                    onChange={e => setReopenReason(e.target.value)}
                    placeholder="Reason (optional)"
                    rows={2}
                    style={{ ...inputStyle, resize: "none", marginBottom: 8 }}
                  />
                  <div style={{ display: "flex", gap: 7 }}>
                    <button type="button" onClick={() => reopenIssue(reopenId)}
                      style={{
                        flex: 1, padding: "7px 0", borderRadius: 5,
                        border: "1px solid rgba(240,160,48,0.5)",
                        background: "rgba(240,160,48,0.12)", color: "#f0a030",
                        fontSize: 12, fontWeight: 700, cursor: "pointer",
                      }}>
                      Confirm Reopen
                    </button>
                    <button type="button" onClick={() => setReopenId(null)}
                      style={{ padding: "7px 13px", borderRadius: 5, border: "1px solid var(--line)", background: "none", color: "var(--ink-3)", fontSize: 12, cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Create issue form */}
              {creating ? (
                <div style={{
                  background: "var(--card)", border: "1px solid var(--line)",
                  borderRadius: 7, padding: "13px",
                }}>
                  <div className="mono" style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "var(--ink-2)", marginBottom: 9 }}>
                    REPORT ISSUE
                  </div>
                  <input
                    type="text"
                    className="ip-input"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="Title (required)"
                    maxLength={200}
                    style={{ ...inputStyle, marginBottom: 7 }}
                  />
                  <textarea
                    className="ip-input"
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="Details (optional)"
                    rows={2}
                    maxLength={2000}
                    style={{ ...inputStyle, resize: "vertical", marginBottom: 9 }}
                  />
                  {/* Priority picker */}
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10.5, color: "var(--ink-3)" }}>Priority</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      {([0, 1, 2, 3, 4, 5] as const).map(p => (
                        <button key={p} type="button" onClick={() => setNewPriority(p)}
                          style={{
                            width: 27, height: 25, borderRadius: 4, fontSize: 10, fontWeight: 800,
                            border: `1px solid ${newPriority === p ? P_COLOR[p] : "var(--line)"}`,
                            background: newPriority === p ? P_BG[p] : "var(--sub)",
                            color: newPriority === p ? P_COLOR[p] : "var(--ink-4)",
                            cursor: "pointer", fontFamily: "var(--font-mono)",
                          }}>
                          {p}
                        </button>
                      ))}
                    </div>
                    <span className="mono" style={{ fontSize: 9.5, color: P_COLOR[newPriority], fontWeight: 700 }}>
                      {P_LABEL[newPriority]}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 7 }}>
                    <button type="button" onClick={createIssue}
                      disabled={!newTitle.trim() || submitting}
                      style={{
                        flex: 1, padding: "7px 0", borderRadius: 5, border: "none",
                        background: "var(--green)", color: "#001a0e", fontSize: 12, fontWeight: 700,
                        cursor: newTitle.trim() && !submitting ? "pointer" : "not-allowed",
                        opacity: newTitle.trim() && !submitting ? 1 : 0.5,
                      }}>
                      {submitting ? "Submitting…" : "Submit Report"}
                    </button>
                    <button type="button" onClick={() => { setCreating(false); setNewTitle(""); setNewDesc(""); }}
                      style={{ padding: "7px 13px", borderRadius: 5, border: "1px solid var(--line)", background: "none", color: "var(--ink-3)", fontSize: 12, cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : canReport && !solvingId && !reopenId ? (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  style={{
                    width: "100%", padding: "9px 0",
                    border: "1px dashed var(--line)", borderRadius: 6,
                    background: "var(--sub)", color: "var(--ink-4)",
                    fontSize: 12, fontWeight: 500, cursor: "pointer",
                    transition: "border-color 0.12s, color 0.12s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--green)"; e.currentTarget.style.color = "var(--green)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--line)";  e.currentTarget.style.color = "var(--ink-4)"; }}
                >
                  + Report an Issue
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
