"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

/* ── Types ───────────────────────────────────────────────────── */
type IssueStatus = "open" | "in_progress" | "staging" | "archived";
type TabFilter   = "active" | "staging" | "archived";

interface Issue {
  issue_id:              string;
  title:                 string;
  description:           string | null;
  reported_by:           string;
  reporter_role:         string | null;
  priority:              number;
  status:                IssueStatus;
  raise_count:           number;
  reopen_count:          number;
  created_at:            string;
  staging_at:            string | null;
  staging_days_remaining: number | null;
  solution_id:           string | null;
  solution_description:  string | null;
  solution_proposed_by:  string | null;
  solution_created_at:   string | null;
  observed_week_1:       string | null;
  observed_week_2:       string | null;
  observed_week_3:       string | null;
  all_observed_at:       string | null;
}

/* ── Priority constants ──────────────────────────────────────── */
const P_LABEL = ["DIRE", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;
const P_COLOR = ["#f03a57", "#f03a57", "#f0a030", "#eab308", "#4d9cf5", "#6b7280"] as const;
const P_BG    = [
  "rgba(240,58,87,0.18)",  "rgba(240,58,87,0.12)",
  "rgba(240,160,48,0.14)", "rgba(234,179,8,0.13)",
  "rgba(77,156,245,0.13)", "rgba(107,114,128,0.12)",
] as const;

/* ── Helpers ─────────────────────────────────────────────────── */
function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 2)   return "just now";
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function shortEmail(email: string): string {
  return email.split("@")[0] ?? email;
}

/* ── Priority badge ──────────────────────────────────────────── */
function PriorityBadge({ p }: { p: number }) {
  const idx = Math.max(0, Math.min(5, p));
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "2px 7px", borderRadius: 4, fontSize: 9.5, fontWeight: 800,
        letterSpacing: "0.08em", color: P_COLOR[idx], background: P_BG[idx],
        border: `1px solid ${P_COLOR[idx]}40`,
        animation: idx === 0 ? "issue-pulse 1.8s ease-in-out infinite" : undefined,
      }}
    >
      {idx} · {P_LABEL[idx]}
    </span>
  );
}

/* ── Observed-resolve checkbox ───────────────────────────────── */
function ObsBox({
  week, checked, disabled, onCheck,
}: { week: 1 | 2 | 3; checked: boolean; disabled: boolean; onCheck: () => void }) {
  return (
    <button
      type="button"
      onClick={onCheck}
      disabled={disabled || checked}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "4px 9px", borderRadius: 5, border: `1px solid ${checked ? "var(--green)" : "var(--line)"}`,
        background: checked ? "rgba(0,204,122,0.1)" : "var(--sub)",
        cursor: disabled || checked ? "default" : "pointer",
        color: checked ? "var(--green)" : "var(--ink-3)", fontSize: 11,
        transition: "all 0.15s",
      }}
    >
      <span style={{ fontSize: 12 }}>{checked ? "☑" : "☐"}</span>
      <span className="mono" style={{ fontSize: 9.5, letterSpacing: "0.05em" }}>W{week}</span>
    </button>
  );
}

/* ── Single issue card ───────────────────────────────────────── */
function IssueCard({
  issue, expanded, userEmail, canSolve, canRaise,
  onToggle, onRaise, onSolveClick, onObserve, onReopenClick,
}: {
  issue: Issue;
  expanded: boolean;
  userEmail: string;
  canSolve: boolean;
  canRaise: boolean;
  onToggle: () => void;
  onRaise: () => void;
  onSolveClick: () => void;
  onObserve: (week: 1 | 2 | 3) => void;
  onReopenClick: () => void;
}) {
  const hasSolution = Boolean(issue.solution_id);
  const isStaging   = issue.status === "staging";
  const isArchived  = issue.status === "archived";
  const canReopen   = (isStaging || isArchived);
  const alreadyRaised = false; // could track client-side; for now always show button

  const statusColor: Record<IssueStatus, string> = {
    open:        "#4d9cf5",
    in_progress: "#eab308",
    staging:     "#00cc7a",
    archived:    "var(--ink-4)",
  };
  const statusLabel: Record<IssueStatus, string> = {
    open:        "OPEN",
    in_progress: "IN PROGRESS",
    staging:     "STAGING",
    archived:    "ARCHIVED",
  };

  return (
    <div
      style={{
        background: "var(--card)",
        border: `1px solid ${expanded ? "var(--line-hi)" : "var(--line)"}`,
        borderRadius: 8, overflow: "hidden", transition: "border-color 0.15s",
      }}
    >
      {/* Card header — always visible */}
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%", padding: "12px 14px", display: "flex",
          alignItems: "flex-start", gap: 10,
          background: "none", border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 5 }}>
            <PriorityBadge p={issue.priority} />
            <span
              className="mono"
              style={{ fontSize: 9, letterSpacing: "0.07em",
                color: statusColor[issue.status],
                background: `${statusColor[issue.status]}18`,
                border: `1px solid ${statusColor[issue.status]}40`,
                padding: "1px 6px", borderRadius: 3, fontWeight: 700 }}
            >
              {statusLabel[issue.status]}
            </span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-0)", lineHeight: 1.35, marginBottom: 4 }}>
            {issue.title}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>
            {shortEmail(issue.reported_by)}
            {issue.reporter_role && <span style={{ color: "var(--ink-4)" }}> · {issue.reporter_role}</span>}
            {" · "}{timeAgo(issue.created_at)}
            {issue.reopen_count > 0 && (
              <span style={{ color: "var(--amber)", marginLeft: 6 }}>
                ↺{issue.reopen_count} reopened
              </span>
            )}
          </div>
        </div>
        {/* Raise count */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0 }}>
          <span style={{ fontSize: 15 }}>↑</span>
          <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-1)" }}>
            {issue.raise_count}
          </span>
        </div>
        {/* Expand chevron */}
        <span style={{ fontSize: 11, color: "var(--ink-4)", flexShrink: 0, marginTop: 2,
          transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--line)", padding: "14px 14px 16px" }}>

          {/* Description */}
          {issue.description && (
            <p style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.65, marginBottom: 14 }}>
              {issue.description}
            </p>
          )}

          {/* Raise button */}
          {canRaise && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onRaise(); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "5px 12px", borderRadius: 5, fontSize: 11, fontWeight: 600,
                border: "1px solid var(--line)", background: "var(--sub)",
                color: "var(--ink-2)", cursor: "pointer", marginBottom: 14,
                transition: "all 0.15s",
              }}
            >
              ↑ Raise this issue
            </button>
          )}

          {/* Solution section */}
          {hasSolution ? (
            <div style={{
              background: "var(--sub)", borderRadius: 6, padding: "11px 13px", marginBottom: 10,
              border: "1px solid var(--line)",
            }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.08em",
                color: "var(--green)", marginBottom: 6, fontFamily: "var(--font-mono)" }}>
                PROPOSED SOLUTION
              </div>
              <p style={{ fontSize: 12.5, color: "var(--ink-1)", lineHeight: 1.6, marginBottom: 10 }}>
                {issue.solution_description}
              </p>
              <div style={{ fontSize: 10, color: "var(--ink-4)", marginBottom: 10 }}>
                by {shortEmail(issue.solution_proposed_by ?? "")}
                {issue.solution_created_at && <> · {timeAgo(issue.solution_created_at)}</>}
              </div>

              {/* Observed-resolve checkboxes */}
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em",
                color: "var(--ink-3)", marginBottom: 7, fontFamily: "var(--font-mono)" }}>
                OBSERVED RESOLVE
              </div>
              <div style={{ display: "flex", gap: 8 }}>
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
                <div style={{ marginTop: 10, fontSize: 11, color: "var(--green)" }}>
                  ◉ Staging · {issue.staging_days_remaining} day{issue.staging_days_remaining !== 1 ? "s" : ""} remaining before archive
                </div>
              )}
            </div>
          ) : canSolve && !isStaging && !isArchived ? (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onSolveClick(); }}
              style={{
                width: "100%", padding: "8px 0", border: "1px dashed var(--green)",
                borderRadius: 6, background: "rgba(0,204,122,0.05)",
                color: "var(--green)", fontSize: 12, fontWeight: 600,
                cursor: "pointer", marginBottom: 10,
              }}
            >
              + Propose Solution
            </button>
          ) : !hasSolution ? (
            <div style={{ fontSize: 11.5, color: "var(--ink-4)", fontStyle: "italic", marginBottom: 10 }}>
              No solution proposed yet.
            </div>
          ) : null}

          {/* Reopen button */}
          {canReopen && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onReopenClick(); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "5px 12px", borderRadius: 5, fontSize: 11, fontWeight: 600,
                border: "1px solid rgba(240,160,48,0.5)", background: "rgba(240,160,48,0.08)",
                color: "#f0a030", cursor: "pointer",
              }}
            >
              ↺ Reopen — escalates priority
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Main IssuePanel component
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

  /* Create form */
  const [creating,     setCreating]     = useState(false);
  const [newTitle,     setNewTitle]     = useState("");
  const [newDesc,      setNewDesc]      = useState("");
  const [newPriority,  setNewPriority]  = useState(3);
  const [submitting,   setSubmitting]   = useState(false);

  /* Solution form */
  const [solvingId,    setSolvingId]    = useState<string | null>(null);
  const [solutionText, setSolutionText] = useState("");

  /* Reopen form */
  const [reopenId,     setReopenId]     = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState("");

  /* Error banner */
  const [apiError, setApiError] = useState<string | null>(null);

  /* ── API helper — returns error string or null on success ─── */
  async function callApi(url: string, opts: RequestInit): Promise<string | null> {
    try {
      const r = await fetch(url, opts);
      if (r.ok) return null;
      let msg = `HTTP ${r.status}`;
      try {
        const body = await r.json();
        if (body?.error) msg = `${r.status}: ${body.error}`;
      } catch { /* non-JSON body */ }
      console.error("[IssuePanel]", url, msg);
      return msg;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      console.error("[IssuePanel] fetch failed:", msg);
      return msg;
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
      setApiError(e instanceof Error ? e.message : "Network error loading issues");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (open) fetchIssues(); }, [open, fetchIssues]);

  /* Derived counts */
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

  /* API helpers */
  async function createIssue() {
    if (!newTitle.trim() || submitting) return;
    setSubmitting(true);
    setApiError(null);
    const err = await callApi("/api/session/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), description: newDesc.trim() || null, priority: newPriority }),
    });
    setSubmitting(false);
    if (err) { setApiError(`Failed to report issue: ${err}`); return; }
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
    setSubmitting(true);
    setApiError(null);
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

  /* ── No session → nothing rendered ──────────────────────── */
  if (!session) return null;

  const TABS: { id: TabFilter; label: string; count: number }[] = [
    { id: "active",   label: "ACTIVE",   count: activeCount   },
    { id: "staging",  label: "STAGING",  count: stagingCount  },
    { id: "archived", label: "ARCHIVED", count: archivedCount },
  ];

  return (
    <>
      {/* ── Keyframes ── */}
      <style>{`
        @keyframes issue-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.55; }
        }
        @keyframes issue-slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
      `}</style>

      {/* ── FAB trigger ──────────────────────────────────────── */}
      <button
        type="button"
        aria-label="Issue tracker"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 900,
          width: 50, height: 50, borderRadius: "50%",
          background: "var(--green)", border: "none",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 18px rgba(0,204,122,0.35)",
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = "scale(1.08)";
          e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,204,122,0.5)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 4px 18px rgba(0,204,122,0.35)";
        }}
      >
        {/* Flag icon */}
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 2v16M4 2h10l-2 4 2 4H4" stroke="#001a0e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>

        {/* Badge */}
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

      {/* ── Panel overlay ────────────────────────────────────── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: "absolute", top: 0, right: 0, bottom: 0,
              width: "min(440px, 100vw)",
              background: "var(--canvas)",
              borderLeft: "1px solid var(--line)",
              display: "flex", flexDirection: "column",
              animation: "issue-slide-in 0.22s ease-out",
            }}
          >
            {/* ── Error banner ──────────────────────────────── */}
            {apiError && (
              <div style={{
                background: "rgba(240,58,87,0.12)", borderBottom: "1px solid rgba(240,58,87,0.35)",
                padding: "9px 16px", display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontSize: 13, color: "#f03a57" }}>⚠</span>
                <span style={{ flex: 1, fontSize: 11.5, color: "#f03a57", lineHeight: 1.4 }}>
                  {apiError}
                </span>
                <button type="button" onClick={() => setApiError(null)}
                  style={{ background: "none", border: "none", color: "#f03a57", cursor: "pointer", fontSize: 14, padding: 2 }}>
                  ✕
                </button>
              </div>
            )}

            {/* ── Panel header ──────────────────────────────── */}
            <div style={{
              padding: "16px 20px 0",
              borderBottom: "1px solid var(--line)",
            }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <div className="mono" style={{
                    fontSize: 9.5, fontWeight: 800, letterSpacing: "0.12em",
                    color: "var(--green)", marginBottom: 3,
                  }}>
                    ISSUE TRACKER
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                    {shortEmail(userEmail)}
                    {roles[0] && <span style={{ color: "var(--ink-4)" }}> · {roles[0]}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{
                    background: "none", border: "1px solid var(--line)",
                    borderRadius: 6, padding: "5px 10px", cursor: "pointer",
                    color: "var(--ink-3)", fontSize: 11,
                    display: "flex", alignItems: "center", gap: 5,
                  }}
                >
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                    <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  ESC
                </button>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 0 }}>
                {TABS.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    style={{
                      padding: "8px 16px", border: "none", background: "none",
                      borderBottom: `2px solid ${tab === t.id ? "var(--green)" : "transparent"}`,
                      marginBottom: -1,
                      color: tab === t.id ? "var(--ink-0)" : "var(--ink-4)",
                      fontSize: 11, fontWeight: tab === t.id ? 700 : 400,
                      letterSpacing: "0.06em", cursor: "pointer",
                      transition: "color 0.12s, border-color 0.12s",
                      display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <span className="mono">{t.label}</span>
                    {t.count > 0 && (
                      <span style={{
                        background: tab === t.id ? "var(--green)" : "var(--sub)",
                        color: tab === t.id ? "#001a0e" : "var(--ink-3)",
                        borderRadius: 10, padding: "0 5px", fontSize: 9.5, fontWeight: 800,
                        fontFamily: "var(--font-mono)",
                      }}>
                        {t.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Issue list ────────────────────────────────── */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 0" }}>
              {loading ? (
                <div style={{ textAlign: "center", color: "var(--ink-4)", fontSize: 12, padding: "32px 0" }}>
                  Loading issues…
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--ink-4)", fontSize: 12, padding: "40px 0" }}>
                  {tab === "active"   && "No active issues."}
                  {tab === "staging"  && "No issues in staging."}
                  {tab === "archived" && "No archived issues."}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {filtered.map(issue => (
                    <IssueCard
                      key={issue.issue_id}
                      issue={issue}
                      expanded={expandedId === issue.issue_id}
                      userEmail={userEmail}
                      canSolve={canSolve}
                      canRaise={canRaise}
                      onToggle={() => setExpandedId(prev => prev === issue.issue_id ? null : issue.issue_id)}
                      onRaise={() => raiseIssue(issue.issue_id)}
                      onSolveClick={() => { setSolvingId(issue.issue_id); setSolutionText(""); }}
                      onObserve={week => markObserved(issue.issue_id, week)}
                      onReopenClick={() => { setReopenId(issue.issue_id); setReopenReason(""); }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── Footer: Create / Solve / Reopen forms ─────── */}
            <div style={{ padding: "14px 16px", borderTop: "1px solid var(--line)" }}>

              {/* Add solution form */}
              {solvingId && (
                <div style={{
                  background: "var(--card)", border: "1px solid var(--line)",
                  borderRadius: 8, padding: "14px", marginBottom: 12,
                }}>
                  <div className="mono" style={{
                    fontSize: 9.5, fontWeight: 800, letterSpacing: "0.1em",
                    color: "var(--green)", marginBottom: 9,
                  }}>
                    PROPOSE SOLUTION
                  </div>
                  <textarea
                    value={solutionText}
                    onChange={e => setSolutionText(e.target.value)}
                    placeholder="Describe the proposed fix or approach…"
                    rows={3}
                    style={{
                      width: "100%", resize: "vertical", padding: "8px 10px",
                      background: "var(--sub)", border: "1px solid var(--line)",
                      borderRadius: 5, color: "var(--ink-0)", fontSize: 12.5,
                      outline: "none", boxSizing: "border-box",
                    }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button type="button" onClick={() => addSolution(solvingId)}
                      disabled={!solutionText.trim() || submitting}
                      style={{
                        flex: 1, padding: "7px 0", borderRadius: 5, border: "none",
                        background: "var(--green)", color: "#001a0e", fontSize: 12, fontWeight: 700,
                        cursor: solutionText.trim() ? "pointer" : "default", opacity: solutionText.trim() ? 1 : 0.5,
                      }}>
                      Submit
                    </button>
                    <button type="button" onClick={() => setSolvingId(null)}
                      style={{
                        padding: "7px 14px", borderRadius: 5, border: "1px solid var(--line)",
                        background: "none", color: "var(--ink-3)", fontSize: 12, cursor: "pointer",
                      }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Reopen form */}
              {reopenId && (
                <div style={{
                  background: "var(--card)", border: "1px solid rgba(240,160,48,0.4)",
                  borderRadius: 8, padding: "14px", marginBottom: 12,
                }}>
                  <div className="mono" style={{
                    fontSize: 9.5, fontWeight: 800, letterSpacing: "0.1em",
                    color: "#f0a030", marginBottom: 9,
                  }}>
                    REOPEN ISSUE — escalates priority by 1
                  </div>
                  <textarea
                    value={reopenReason}
                    onChange={e => setReopenReason(e.target.value)}
                    placeholder="Reason for reopening (optional)…"
                    rows={2}
                    style={{
                      width: "100%", resize: "none", padding: "8px 10px",
                      background: "var(--sub)", border: "1px solid var(--line)",
                      borderRadius: 5, color: "var(--ink-0)", fontSize: 12.5,
                      outline: "none", boxSizing: "border-box",
                    }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button type="button" onClick={() => reopenIssue(reopenId)}
                      style={{
                        flex: 1, padding: "7px 0", borderRadius: 5,
                        border: "1px solid rgba(240,160,48,0.5)",
                        background: "rgba(240,160,48,0.15)", color: "#f0a030",
                        fontSize: 12, fontWeight: 700, cursor: "pointer",
                      }}>
                      Confirm Reopen
                    </button>
                    <button type="button" onClick={() => setReopenId(null)}
                      style={{
                        padding: "7px 14px", borderRadius: 5, border: "1px solid var(--line)",
                        background: "none", color: "var(--ink-3)", fontSize: 12, cursor: "pointer",
                      }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Report issue form */}
              {creating ? (
                <div style={{
                  background: "var(--card)", border: "1px solid var(--line)",
                  borderRadius: 8, padding: "14px",
                }}>
                  <div className="mono" style={{
                    fontSize: 9.5, fontWeight: 800, letterSpacing: "0.1em",
                    color: "var(--ink-1)", marginBottom: 9,
                  }}>
                    REPORT ISSUE
                  </div>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="Issue title (required)"
                    maxLength={200}
                    style={{
                      width: "100%", padding: "8px 10px", marginBottom: 8,
                      background: "var(--sub)", border: "1px solid var(--line)",
                      borderRadius: 5, color: "var(--ink-0)", fontSize: 12.5,
                      outline: "none", boxSizing: "border-box",
                    }}
                  />
                  <textarea
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="Details (optional)"
                    rows={2}
                    maxLength={2000}
                    style={{
                      width: "100%", resize: "vertical", padding: "8px 10px", marginBottom: 8,
                      background: "var(--sub)", border: "1px solid var(--line)",
                      borderRadius: 5, color: "var(--ink-0)", fontSize: 12.5,
                      outline: "none", boxSizing: "border-box",
                    }}
                  />
                  {/* Priority selector */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: "var(--ink-3)" }}>Priority:</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      {([0, 1, 2, 3, 4, 5] as const).map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setNewPriority(p)}
                          style={{
                            width: 28, height: 26, borderRadius: 4, fontSize: 10, fontWeight: 700,
                            border: `1px solid ${newPriority === p ? P_COLOR[p] : "var(--line)"}`,
                            background: newPriority === p ? P_BG[p] : "var(--sub)",
                            color: newPriority === p ? P_COLOR[p] : "var(--ink-4)",
                            cursor: "pointer",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    <span style={{ fontSize: 10, color: P_COLOR[newPriority] }}>
                      {P_LABEL[newPriority]}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={createIssue}
                      disabled={!newTitle.trim() || submitting}
                      style={{
                        flex: 1, padding: "7px 0", borderRadius: 5, border: "none",
                        background: "var(--green)", color: "#001a0e", fontSize: 12, fontWeight: 700,
                        cursor: newTitle.trim() ? "pointer" : "default", opacity: newTitle.trim() ? 1 : 0.5,
                      }}>
                      Submit Report
                    </button>
                    <button type="button" onClick={() => { setCreating(false); setNewTitle(""); setNewDesc(""); }}
                      style={{
                        padding: "7px 14px", borderRadius: 5, border: "1px solid var(--line)",
                        background: "none", color: "var(--ink-3)", fontSize: 12, cursor: "pointer",
                      }}>
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
                    background: "var(--sub)", color: "var(--ink-3)",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    transition: "border-color 0.15s, color 0.15s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = "var(--green)";
                    e.currentTarget.style.color = "var(--green)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = "var(--line)";
                    e.currentTarget.style.color = "var(--ink-3)";
                  }}
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
