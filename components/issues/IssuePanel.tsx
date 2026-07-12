"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  AreaChart, Area, BarChart, Bar,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

/* ── Types ───────────────────────────────────────────────────── */
type IssueStatus = "open" | "in_progress" | "staging" | "archived";
type TabFilter   = "open" | "staging" | "archived" | "insight";
type Category    = "execution" | "risk" | "technical" | "compliance" | "process" | "market" | "other";

interface SubIssue {
  issue_id:    string;
  title:       string;
  priority:    number;
  category:    Category;
  status:      IssueStatus;
  raise_count: number;
  created_at:  string;
}

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
  category:               Category;
  impact_score:           number;
  tags:                   string[];
  parent_issue_id:        string | null;
  status:                 IssueStatus;
  raise_count:            number;
  reopen_count:           number;
  created_at:             string;
  staging_at:             string | null;
  staging_days_remaining: number | null;
  closed_at:              string | null;
  resolution_note:        string | null;
  solution_id:            string | null;
  solution_description:   string | null;
  solution_proposed_by:   string | null;
  solution_created_at:    string | null;
  solution_votes:         number;
  observed_week_1:        string | null;
  observed_week_2:        string | null;
  observed_week_3:        string | null;
  all_observed_at:        string | null;
  scratched_solutions:    ScratchedSolution[];
  sub_issues:             SubIssue[];
}

/* ── Constants ───────────────────────────────────────────────── */
const P_LABEL = ["DIRE", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;
const P_COLOR = ["#f03a57", "#f03a57", "#f0a030", "#eab308", "#4d9cf5", "#8ea3be"] as const;
const P_BG    = [
  "rgba(240,58,87,0.16)",  "rgba(240,58,87,0.10)",
  "rgba(240,160,48,0.13)", "rgba(234,179,8,0.11)",
  "rgba(77,156,245,0.11)", "rgba(142,163,190,0.10)",
] as const;

const CAT: Record<Category, { label: string; icon: string; color: string }> = {
  execution:  { label: "Execution",  icon: "⚡", color: "#f0a030" },
  risk:       { label: "Risk",       icon: "⚠",  color: "#f03a57" },
  technical:  { label: "Technical",  icon: "⚙",  color: "#4d9cf5" },
  compliance: { label: "Compliance", icon: "⚖",  color: "#a78bfa" },
  process:    { label: "Process",    icon: "◎",  color: "#34d399" },
  market:     { label: "Market",     icon: "↗",  color: "#f59e0b" },
  other:      { label: "Other",      icon: "○",  color: "#6b7280" },
};

const ST_COLOR: Record<IssueStatus, string> = {
  open:        "#6b7280",
  in_progress: "#4d9cf5",
  staging:     "#f0a030",
  archived:    "#34d399",
};
const ST_LABEL: Record<IssueStatus, string> = {
  open:        "OPEN",
  in_progress: "IN PROGRESS",
  staging:     "STAGING",
  archived:    "ARCHIVED",
};

/* ── Helpers ─────────────────────────────────────────────────── */
function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 2)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

function shortEmail(email: string): string {
  return email.split("@")[0];
}

async function callApi(url: string, opts: RequestInit): Promise<string | null> {
  try {
    const r = await fetch(url, {
      ...opts,
      headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
    });
    if (r.ok) return null;
    const j = await r.json().catch(() => ({}));
    return (j as any)?.error ?? `Error ${r.status}`;
  } catch {
    return "Network error";
  }
}

/* ── Shared style token ──────────────────────────────────────── */
const INPUT: React.CSSProperties = {
  background:   "rgba(255,255,255,0.06)",
  border:       "1px solid rgba(255,255,255,0.12)",
  borderRadius: "5px",
  color:        "var(--fg)",
  padding:      "6px 9px",
  fontSize:     "12px",
  outline:      "none",
  width:        "100%",
  boxSizing:    "border-box",
};

/* Shared style for <select> elements — overrides browser default dropdown chrome */
const SELECT: React.CSSProperties = {
  ...INPUT,
  appearance:          "none",
  WebkitAppearance:    "none",
  backgroundImage:     "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%235a7490' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E\")",
  backgroundRepeat:    "no-repeat",
  backgroundPosition:  "right 9px center",
  paddingRight:        "26px",
  colorScheme:         "dark",
  cursor:              "pointer",
};

/* Background/color applied to every <option> so the native popup stays dark */
const OPT: React.CSSProperties = { background: "#0c1828", color: "#c4d4e4" };

/* ── Atom badges ─────────────────────────────────────────────── */
function PriorityBadge({ p }: { p: number }) {
  return (
    <span
      style={{
        padding:       "2px 7px",
        borderRadius:  "4px",
        fontSize:      "10px",
        fontWeight:    700,
        letterSpacing: "0.4px",
        background:    P_BG[p],
        color:         P_COLOR[p],
        animation:     p === 0 ? "pulse-red 1.4s ease-in-out infinite" : "none",
        flexShrink:    0,
      }}
    >
      {P_LABEL[p]}
    </span>
  );
}

function CategoryBadge({ cat }: { cat: Category }) {
  const c = CAT[cat] ?? CAT.other;
  return (
    <span
      style={{
        display:      "inline-flex",
        alignItems:   "center",
        gap:          "3px",
        padding:      "2px 7px",
        borderRadius: "4px",
        fontSize:     "11px",
        fontWeight:   500,
        background:   `${c.color}18`,
        color:        c.color,
        flexShrink:   0,
      }}
    >
      {c.icon} {c.label}
    </span>
  );
}

function ImpactBar({ score }: { score: number }) {
  const color = score >= 8 ? "#f03a57" : score >= 6 ? "#f0a030" : score >= 4 ? "#eab308" : "#4d9cf5";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "5px", minWidth: "100px" }}>
      <span style={{ fontSize: "9px", color: "#6b7280", flexShrink: 0 }}>Impact</span>
      <div
        style={{ flex: 1, height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}
      >
        <div style={{ width: `${(score / 10) * 100}%`, height: "100%", background: color, borderRadius: "2px" }} />
      </div>
      <span style={{ fontSize: "10px", color, fontWeight: 700, minWidth: "26px" }}>{score}/10</span>
    </div>
  );
}

function ObsBox({ done, label, onClick }: { done: boolean; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={done || !onClick}
      style={{
        display:      "inline-flex",
        alignItems:   "center",
        gap:          "3px",
        padding:      "3px 8px",
        borderRadius: "4px",
        fontSize:     "11px",
        fontWeight:   600,
        border:       `1px solid ${done ? "#00cc7a" : "rgba(255,255,255,0.1)"}`,
        background:   done ? "rgba(0,204,122,0.12)" : "rgba(255,255,255,0.03)",
        color:        done ? "#00cc7a" : "#6b7280",
        cursor:       done || !onClick ? "default" : "pointer",
      }}
    >
      {done ? "✓" : "○"} {label}
    </button>
  );
}

/* ── Sub-issue row ───────────────────────────────────────────── */
function SubIssueRow({ sub }: { sub: SubIssue }) {
  const c = CAT[sub.category] ?? CAT.other;
  return (
    <div
      style={{
        display:      "flex",
        alignItems:   "center",
        gap:          "6px",
        padding:      "5px 8px",
        borderRadius: "4px",
        background:   "rgba(255,255,255,0.025)",
        borderLeft:   `2px solid ${P_COLOR[sub.priority]}`,
      }}
    >
      <span style={{ fontSize: "9px", color: c.color }}>{c.icon}</span>
      <span
        style={{
          fontSize: "12px", flex: 1,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        {sub.title}
      </span>
      <span style={{ fontSize: "9px", fontWeight: 700, color: P_COLOR[sub.priority], flexShrink: 0 }}>
        {P_LABEL[sub.priority]}
      </span>
      <span
        style={{
          fontSize:     "9px",
          padding:      "1px 5px",
          borderRadius: "3px",
          background:   `${ST_COLOR[sub.status]}18`,
          color:        ST_COLOR[sub.status],
          flexShrink:   0,
        }}
      >
        {ST_LABEL[sub.status]}
      </span>
    </div>
  );
}

/* ── RECORD section ──────────────────────────────────────────── */
function RecordSection({
  issue, canRecord, onRaise, onRefresh,
}: {
  issue: Issue; canRecord: boolean; onRaise: () => void; onRefresh: () => void;
}) {
  const [subOpen,    setSubOpen]    = useState(false);
  const [formOpen,   setFormOpen]   = useState(false);
  const [subForm,    setSubForm]    = useState({ title: "", priority: 3, category: "other" as Category });
  const [subErr,     setSubErr]     = useState<string | null>(null);
  const [subBusy,    setSubBusy]    = useState(false);

  async function addSubIssue() {
    if (!subForm.title.trim()) { setSubErr("Title required"); return; }
    setSubBusy(true);
    const err = await callApi("/api/session/issues", {
      method: "POST",
      body:   JSON.stringify({ ...subForm, parent_issue_id: issue.issue_id }),
    });
    setSubBusy(false);
    if (err) { setSubErr(err); return; }
    setSubForm({ title: "", priority: 3, category: "other" });
    setFormOpen(false);
    onRefresh();
  }

  return (
    <div
      style={{
        borderLeft:    "3px solid #4d9cf5",
        borderRadius:  "0 6px 6px 0",
        background:    "rgba(77,156,245,0.04)",
        padding:       "10px 12px",
        display:       "flex",
        flexDirection: "column",
        gap:           "8px",
      }}
    >
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
        <span style={{ fontSize: "10px", fontWeight: 700, color: "#4d9cf5", letterSpacing: "0.5px" }}>
          RECORDER · {shortEmail(issue.reported_by).toUpperCase()}
          {issue.reporter_role ? ` · ${issue.reporter_role.toUpperCase()}` : ""}
        </span>
        <ImpactBar score={issue.impact_score} />
      </div>

      {/* Category + tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
        <CategoryBadge cat={issue.category} />
        {issue.tags.map(tag => (
          <span
            key={tag}
            style={{
              padding:      "1px 7px",
              borderRadius: "10px",
              fontSize:     "10px",
              background:   "rgba(255,255,255,0.05)",
              color:        "#6b7280",
              border:       "1px solid rgba(255,255,255,0.07)",
            }}
          >
            #{tag}
          </span>
        ))}
      </div>

      {/* Description */}
      {issue.description && (
        <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.6, color: "var(--fg)", opacity: 0.8, whiteSpace: "pre-wrap" }}>
          {issue.description}
        </p>
      )}

      {/* Sub-issues list */}
      {issue.sub_issues.length > 0 && (
        <div>
          <button
            onClick={() => setSubOpen(v => !v)}
            style={{
              background: "none", border: "none", color: "#4d9cf5",
              fontSize: "11px", cursor: "pointer", padding: "0", fontWeight: 600,
            }}
          >
            {subOpen ? "▾" : "▸"} {issue.sub_issues.length} sub-issue
            {issue.sub_issues.length !== 1 ? "s" : ""}
          </button>
          {subOpen && (
            <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px" }}>
              {issue.sub_issues.map(s => <SubIssueRow key={s.issue_id} sub={s} />)}
            </div>
          )}
        </div>
      )}

      {/* Add sub-issue form */}
      {formOpen && (
        <div
          style={{
            padding:       "8px",
            borderRadius:  "5px",
            background:    "rgba(77,156,245,0.06)",
            border:        "1px solid rgba(77,156,245,0.2)",
            display:       "flex",
            flexDirection: "column",
            gap:           "6px",
          }}
        >
          <span style={{ fontSize: "10px", fontWeight: 700, color: "#4d9cf5" }}>NEW SUB-ISSUE</span>
          {subErr && <span style={{ fontSize: "11px", color: "#f03a57" }}>{subErr}</span>}
          <input
            style={INPUT}
            placeholder="Title"
            value={subForm.title}
            onChange={e => setSubForm(f => ({ ...f, title: e.target.value }))}
            maxLength={200}
          />
          <div style={{ display: "flex", gap: "6px" }}>
            <select
              style={{ ...SELECT, flex: 1 }}
              value={subForm.category}
              onChange={e => setSubForm(f => ({ ...f, category: e.target.value as Category }))}
            >
              {(Object.entries(CAT) as [Category, (typeof CAT)[Category]][]).map(([k, v]) => (
                <option key={k} value={k} style={OPT}>{v.icon} {v.label}</option>
              ))}
            </select>
            <select
              style={{ ...SELECT, flex: 1 }}
              value={subForm.priority}
              onChange={e => setSubForm(f => ({ ...f, priority: Number(e.target.value) }))}
            >
              {P_LABEL.map((l, i) => <option key={i} value={i} style={OPT}>{l}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={addSubIssue}
              disabled={subBusy}
              style={{
                flex: 1, padding: "5px", borderRadius: "4px", border: "none",
                background: "#4d9cf5", color: "#fff", fontWeight: 700, fontSize: "11px", cursor: "pointer",
              }}
            >
              {subBusy ? "Adding…" : "Add"}
            </button>
            <button
              onClick={() => { setFormOpen(false); setSubErr(null); }}
              style={{
                padding: "5px 10px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.1)",
                background: "none", color: "#6b7280", fontSize: "11px", cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action row */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={onRaise}
          disabled={!canRecord}
          style={{
            display:      "inline-flex",
            alignItems:   "center",
            gap:          "3px",
            padding:      "4px 10px",
            borderRadius: "4px",
            border:       "1px solid rgba(255,255,255,0.1)",
            background:   "none",
            color:        "#6b7280",
            fontSize:     "11px",
            cursor:       canRecord ? "pointer" : "default",
            opacity:      canRecord ? 1 : 0.45,
          }}
        >
          ↑ Raise ({issue.raise_count})
        </button>
        {canRecord && (
          <button
            onClick={() => { setFormOpen(v => !v); setSubErr(null); }}
            style={{
              padding:      "4px 10px",
              borderRadius: "4px",
              border:       "1px solid rgba(77,156,245,0.3)",
              background:   "rgba(77,156,245,0.08)",
              color:        "#4d9cf5",
              fontSize:     "11px",
              cursor:       "pointer",
              fontWeight:   500,
            }}
          >
            + Sub-issue
          </button>
        )}
        <span style={{ fontSize: "10px", color: "#6b7280" }}>{timeAgo(issue.created_at)}</span>
      </div>
    </div>
  );
}

/* ── RESOLVE section ─────────────────────────────────────────── */
function ResolveSection({
  issue, canResolve, canRecord, solvingId, setSolvingId, onRefresh, onSetError, votedSolutions, onVote,
}: {
  issue: Issue;
  canResolve: boolean;
  canRecord: boolean;
  solvingId: string | null;
  setSolvingId: (id: string | null) => void;
  onRefresh: () => void;
  onSetError: (err: string | null) => void;
  votedSolutions: Set<string>;
  onVote: (issueId: string, solutionId: string) => void;
}) {
  const [scratchedOpen, setScratchedOpen] = useState(false);
  const [solText,       setSolText]       = useState("");
  const [closeForm,     setCloseForm]     = useState(false);
  const [closeNote,     setCloseNote]     = useState("");
  const [reopenForm,    setReopenForm]    = useState(false);
  const [reopenReason,  setReopenReason]  = useState("");
  const [busy,          setBusy]          = useState(false);

  const isSolving  = solvingId === issue.issue_id;
  const isStaging  = issue.status === "staging";
  const isArchived = issue.status === "archived";

  async function run(fn: () => Promise<string | null>, after?: () => void) {
    setBusy(true);
    const err = await fn();
    setBusy(false);
    if (err) { onSetError(err); } else { after?.(); onRefresh(); }
  }

  const TEXTAREA: React.CSSProperties = { ...INPUT, resize: "vertical" };

  return (
    <div
      style={{
        borderLeft:    "3px solid #00cc7a",
        borderRadius:  "0 6px 6px 0",
        background:    "rgba(0,204,122,0.04)",
        padding:       "10px 12px",
        display:       "flex",
        flexDirection: "column",
        gap:           "8px",
      }}
    >
      {/* Header */}
      <div style={{ fontSize: "10px", fontWeight: 700, color: "#00cc7a", letterSpacing: "0.5px" }}>
        RESOLVER
        {issue.solution_proposed_by && (
          <span style={{ fontWeight: 400, color: "#6b7280", marginLeft: "6px" }}>
            · {shortEmail(issue.solution_proposed_by)}
          </span>
        )}
        {issue.reopen_count > 0 && (
          <span style={{ color: "#f0a030", marginLeft: "8px" }}>↺ reopened {issue.reopen_count}×</span>
        )}
      </div>

      {/* Resolution note (archived) */}
      {isArchived && issue.resolution_note && (
        <div
          style={{
            padding:      "8px 10px",
            borderRadius: "5px",
            background:   "rgba(0,204,122,0.08)",
            border:       "1px solid rgba(0,204,122,0.2)",
            fontSize:     "12px",
            color:        "#00cc7a",
          }}
        >
          <div style={{ fontSize: "9px", fontWeight: 700, marginBottom: "4px" }}>RESOLUTION NOTE</div>
          {issue.resolution_note}
        </div>
      )}

      {/* No solution placeholder */}
      {!isArchived && !issue.solution_id && !isSolving && (
        <p style={{ margin: 0, fontSize: "12px", color: "#6b7280", fontStyle: "italic" }}>
          No solution proposed yet.
        </p>
      )}

      {/* Propose solution form */}
      {isSolving && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <textarea
            value={solText}
            onChange={e => setSolText(e.target.value)}
            placeholder="Describe the proposed solution…"
            rows={3}
            style={TEXTAREA}
            maxLength={2000}
          />
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={() => run(
                () => callApi(`/api/session/issues/${issue.issue_id}/solution`, {
                  method: "PUT", body: JSON.stringify({ description: solText }),
                }),
                () => { setSolText(""); setSolvingId(null); }
              )}
              disabled={busy || !solText.trim()}
              style={{
                flex: 1, padding: "5px", borderRadius: "4px", border: "none",
                background: "#00cc7a", color: "#000", fontWeight: 700, fontSize: "11px", cursor: "pointer",
              }}
            >
              {busy ? "Proposing…" : "Propose Solution"}
            </button>
            <button
              onClick={() => { setSolvingId(null); setSolText(""); }}
              style={{
                padding: "5px 10px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.1)",
                background: "none", color: "#6b7280", fontSize: "11px", cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active solution card */}
      {!isArchived && issue.solution_description && !isSolving && (
        <div
          style={{
            padding:       "8px 10px",
            borderRadius:  "5px",
            background:    "rgba(255,255,255,0.03)",
            border:        "1px solid rgba(255,255,255,0.07)",
            display:       "flex",
            flexDirection: "column",
            gap:           "8px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
            <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.6, color: "var(--fg)", opacity: 0.85, flex: 1 }}>
              {issue.solution_description}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", flexShrink: 0, alignItems: "flex-end" }}>
              {(canRecord || canResolve) && issue.solution_id && (() => {
                const voted = votedSolutions.has(issue.solution_id!);
                return (
                  <button
                    onClick={() => { if (!voted && issue.solution_id) onVote(issue.issue_id, issue.solution_id); }}
                    disabled={busy || voted}
                    title={voted ? "You've already upvoted this solution" : "Upvote this solution"}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "4px",
                      padding: "2px 8px", borderRadius: "4px",
                      border: `1px solid ${voted ? "rgba(0,204,122,0.5)" : "rgba(0,204,122,0.25)"}`,
                      background: voted ? "rgba(0,204,122,0.18)" : "rgba(0,204,122,0.06)",
                      color: "#00cc7a", fontSize: "10px",
                      cursor: voted ? "default" : "pointer", fontWeight: 700,
                      transition: "all 0.15s",
                    }}
                  >
                    ▲ {issue.solution_votes}
                  </button>
                );
              })()}
              {canResolve && !isStaging && (
                <button
                  onClick={() => run(() => callApi(`/api/session/issues/${issue.issue_id}/solution`, { method: "DELETE" }))}
                  disabled={busy}
                  style={{
                    padding: "2px 8px", borderRadius: "4px",
                    border: "1px solid rgba(240,58,87,0.3)", background: "rgba(240,58,87,0.08)",
                    color: "#f03a57", fontSize: "10px", cursor: "pointer", flexShrink: 0, fontWeight: 600,
                  }}
                >
                  ✗ Scratch
                </button>
              )}
            </div>
          </div>

          {/* Observed weeks */}
          <div>
            <div style={{ fontSize: "9px", color: "#6b7280", fontWeight: 700, marginBottom: "6px", letterSpacing: "0.4px" }}>
              OBSERVED RESOLVE
            </div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <ObsBox
                done={!!issue.observed_week_1}
                label="Week 1"
                onClick={canResolve && !issue.observed_week_1
                  ? () => run(() => callApi(`/api/session/issues/${issue.issue_id}/observe`, {
                      method: "PATCH", body: JSON.stringify({ week: 1 }),
                    }))
                  : undefined}
              />
              <ObsBox
                done={!!issue.observed_week_2}
                label="Week 2"
                onClick={canResolve && !issue.observed_week_2 && !!issue.observed_week_1
                  ? () => run(() => callApi(`/api/session/issues/${issue.issue_id}/observe`, {
                      method: "PATCH", body: JSON.stringify({ week: 2 }),
                    }))
                  : undefined}
              />
              <ObsBox
                done={!!issue.observed_week_3}
                label="Week 3"
                onClick={canResolve && !issue.observed_week_3 && !!issue.observed_week_2
                  ? () => run(() => callApi(`/api/session/issues/${issue.issue_id}/observe`, {
                      method: "PATCH", body: JSON.stringify({ week: 3 }),
                    }))
                  : undefined}
              />
            </div>
            {isStaging && issue.staging_days_remaining !== null && (
              <div style={{ marginTop: "5px", fontSize: "10px", color: "#f0a030" }}>
                ⏳ {issue.staging_days_remaining}d remaining in staging
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scratched solutions toggle */}
      {issue.scratched_solutions.length > 0 && (
        <div>
          <button
            onClick={() => setScratchedOpen(v => !v)}
            style={{
              background: "none", border: "none", color: "#6b7280",
              fontSize: "11px", cursor: "pointer", padding: "0",
            }}
          >
            {scratchedOpen ? "▾" : "▸"} {issue.scratched_solutions.length} scratched
          </button>
          {scratchedOpen && (
            <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px" }}>
              {issue.scratched_solutions.map(s => (
                <div
                  key={s.solution_id}
                  style={{
                    padding: "6px 8px", borderRadius: "4px",
                    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "11px", color: "#6b7280", textDecoration: "line-through", lineHeight: 1.5 }}>
                    {s.description}
                  </p>
                  <div style={{ fontSize: "9px", color: "rgba(120,120,140,0.55)", marginTop: "3px" }}>
                    {shortEmail(s.scratched_by ?? s.proposed_by)}
                    {s.scratched_at ? ` · ${timeAgo(s.scratched_at)}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {canResolve && !isArchived && !isSolving && (
          <button
            onClick={() => setSolvingId(issue.issue_id)}
            style={{
              padding: "4px 10px", borderRadius: "4px",
              border: "1px solid rgba(0,204,122,0.3)", background: "rgba(0,204,122,0.08)",
              color: "#00cc7a", fontSize: "11px", cursor: "pointer", fontWeight: 500,
            }}
          >
            {issue.solution_id ? "↺ Revise Solution" : "+ Propose Solution"}
          </button>
        )}

        {canResolve && !isArchived && !isStaging && !closeForm && (
          <button
            onClick={() => setCloseForm(true)}
            style={{
              padding: "4px 10px", borderRadius: "4px",
              border: "1px solid rgba(52,211,153,0.25)", background: "rgba(52,211,153,0.06)",
              color: "#34d399", fontSize: "11px", cursor: "pointer", fontWeight: 500,
            }}
          >
            ✓ Close Issue
          </button>
        )}

        {(isStaging || isArchived) && !reopenForm && (
          <button
            onClick={() => setReopenForm(true)}
            style={{
              padding: "4px 10px", borderRadius: "4px",
              border: "1px solid rgba(240,160,48,0.3)", background: "rgba(240,160,48,0.08)",
              color: "#f0a030", fontSize: "11px", cursor: "pointer", fontWeight: 500,
            }}
          >
            ⚑ Reopen
          </button>
        )}

        {closeForm && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "6px" }}>
            <textarea
              value={closeNote}
              onChange={e => setCloseNote(e.target.value)}
              placeholder="Resolution note (optional)…"
              rows={2}
              style={TEXTAREA}
              maxLength={1000}
            />
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                onClick={() => run(
                  () => callApi(`/api/session/issues/${issue.issue_id}/close`, {
                    method: "POST", body: JSON.stringify({ resolution_note: closeNote }),
                  }),
                  () => setCloseForm(false)
                )}
                disabled={busy}
                style={{
                  flex: 1, padding: "5px", borderRadius: "4px", border: "none",
                  background: "#34d399", color: "#000", fontWeight: 700, fontSize: "11px", cursor: "pointer",
                }}
              >
                {busy ? "Closing…" : "Confirm Close"}
              </button>
              <button
                onClick={() => { setCloseForm(false); setCloseNote(""); }}
                style={{
                  padding: "5px 10px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.1)",
                  background: "none", color: "#6b7280", fontSize: "11px", cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {reopenForm && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "6px" }}>
            <textarea
              value={reopenReason}
              onChange={e => setReopenReason(e.target.value)}
              placeholder="Reason for reopening…"
              rows={2}
              style={TEXTAREA}
              maxLength={500}
            />
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                onClick={() => run(
                  () => callApi(`/api/session/issues/${issue.issue_id}/reopen`, {
                    method: "POST", body: JSON.stringify({ reason: reopenReason }),
                  }),
                  () => { setReopenForm(false); setReopenReason(""); }
                )}
                disabled={busy}
                style={{
                  flex: 1, padding: "5px", borderRadius: "4px", border: "none",
                  background: "#f0a030", color: "#000", fontWeight: 700, fontSize: "11px", cursor: "pointer",
                }}
              >
                {busy ? "Reopening…" : "Confirm Reopen"}
              </button>
              <button
                onClick={() => { setReopenForm(false); setReopenReason(""); }}
                style={{
                  padding: "5px 10px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.1)",
                  background: "none", color: "#6b7280", fontSize: "11px", cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Insight tab ─────────────────────────────────────────────── */
function InsightTab({ issues }: { issues: Issue[] }) {
  const now     = Date.now();
  const total   = issues.length;
  const openCnt = issues.filter(i => i.status === "open" || i.status === "in_progress").length;
  const stagCnt = issues.filter(i => i.status === "staging").length;
  const archCnt = issues.filter(i => i.status === "archived").length;
  const inProgCnt = issues.filter(i => i.status === "in_progress").length;

  /* ── Velocity metrics ────────────────────────────────────────── */
  const velocity = useMemo(() => {
    /* Avg resolution time: created → staged or closed */
    const resolved = issues.filter(i => i.staging_at || i.closed_at);
    const avgResolutionDays = resolved.length > 0
      ? Math.round(
          resolved.reduce((sum, i) => {
            const end = i.closed_at  ? new Date(i.closed_at).getTime()
                      : new Date(i.staging_at!).getTime();
            return sum + (end - new Date(i.created_at).getTime()) / 86_400_000;
          }, 0) / resolved.length
        )
      : null;

    /* Avg age of currently-open issues */
    const open = issues.filter(i => i.status === "open" || i.status === "in_progress");
    const avgAgeDays = open.length > 0
      ? Math.round(
          open.reduce((sum, i) => sum + (now - new Date(i.created_at).getTime()) / 86_400_000, 0) / open.length
        )
      : null;

    /* Net backlog over last 4 weeks: +ve = backlog growing, -ve = shrinking */
    const fourWeeksAgo = now - 4 * 7 * 86_400_000;
    const recentCreated  = issues.filter(i => new Date(i.created_at).getTime() >= fourWeeksAgo).length;
    const recentResolved = issues.filter(i => {
      const t = i.closed_at ? new Date(i.closed_at).getTime()
              : i.staging_at ? new Date(i.staging_at).getTime() : 0;
      return t >= fourWeeksAgo;
    }).length;
    const netBacklog = recentCreated - recentResolved;

    /* Solution rate: issues that have / had a solution / are in progress */
    const withSolution = issues.filter(i =>
      i.solution_id || i.status === "staging" || i.status === "archived"
    ).length;
    const solutionRate = total > 0 ? Math.round((withSolution / total) * 100) : 0;

    return { avgResolutionDays, avgAgeDays, netBacklog, solutionRate };
  }, [issues, now]);

  /* ── Weekly activity ─────────────────────────────────────────── */
  const weeklyData = useMemo(() => {
    const MS_WEEK = 7 * 86_400_000;
    return Array.from({ length: 8 }, (_, wi) => {
      const wStart = now - (7 - wi) * MS_WEEK;
      const wEnd   = wStart + MS_WEEK;
      const label  = new Date(wStart).toLocaleDateString("en-AU", { month: "short", day: "numeric" });
      return {
        label,
        Created: issues.filter(i => {
          const t = new Date(i.created_at).getTime();
          return t >= wStart && t < wEnd;
        }).length,
        Resolved: issues.filter(i => {
          const t = i.closed_at  ? new Date(i.closed_at).getTime()
                  : i.staging_at ? new Date(i.staging_at).getTime() : 0;
          return t > 0 && t >= wStart && t < wEnd;
        }).length,
      };
    });
  }, [issues, now]);

  /* ── Category breakdown ──────────────────────────────────────── */
  const catData = useMemo(() => {
    const map = new Map<Category, { open: number; resolved: number }>();
    for (const k of Object.keys(CAT) as Category[]) map.set(k, { open: 0, resolved: 0 });
    for (const i of issues) {
      const k = (CAT[i.category] ? i.category : "other") as Category;
      const e = map.get(k)!;
      if (i.status === "open" || i.status === "in_progress") e.open++;
      else e.resolved++;
    }
    return [...map.entries()]
      .map(([k, v]) => ({
        name:     CAT[k].label,
        Open:     v.open,
        Resolved: v.resolved,
        total:    v.open + v.resolved,
        color:    CAT[k].color,
      }))
      .filter(d => d.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [issues]);

  /* ── Priority distribution ───────────────────────────────────── */
  const prioData = useMemo(() =>
    [0, 1, 2, 3, 4, 5]
      .map(p => ({
        label: P_LABEL[p],
        count: issues.filter(i => i.priority === p).length,
        color: P_COLOR[p],
      }))
      .filter(d => d.count > 0),
    [issues]
  );

  /* ── Helpers ─────────────────────────────────────────────────── */
  const TT = {
    contentStyle: {
      background:   "rgba(14,14,22,0.97)",
      border:       "1px solid rgba(255,255,255,0.1)",
      borderRadius: "6px",
      color:        "#d0d4e0",
      fontSize:     "11px",
      padding:      "5px 9px",
    },
  };

  function Divider() {
    return <div style={{ height: "1px", background: "rgba(255,255,255,0.06)" }} />;
  }

  function SLabel({ t }: { t: string }) {
    return (
      <div style={{ fontSize: "10px", fontWeight: 700, color: "#6b7280", marginBottom: "10px", letterSpacing: "0.6px" }}>
        {t}
      </div>
    );
  }

  /* Color-code the net backlog */
  const backlogColor  = velocity.netBacklog  < 0 ? "#00cc7a" : velocity.netBacklog  === 0 ? "#6b7280" : "#f03a57";
  const backlogPrefix = velocity.netBacklog  > 0 ? "+" : "";
  /* Color-code avg resolution */
  const resColor = velocity.avgResolutionDays == null ? "#6b7280"
    : velocity.avgResolutionDays <= 7  ? "#00cc7a"
    : velocity.avgResolutionDays <= 21 ? "#f0a030"
    : "#f03a57";
  /* Color-code avg age */
  const ageColor = velocity.avgAgeDays == null ? "#6b7280"
    : velocity.avgAgeDays <= 14 ? "#00cc7a"
    : velocity.avgAgeDays <= 30 ? "#f0a030"
    : "#f03a57";

  if (total === 0) {
    return (
      <div style={{ textAlign: "center", color: "#6b7280", fontSize: "13px", padding: "60px 0" }}>
        No issue data yet
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* ── Status overview ───────────────────────────────────── */}
      <div>
        <SLabel t="STATUS OVERVIEW" />
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {[
            { label: "Total",       value: String(total),   color: "#8ea3be" },
            { label: "Active",      value: String(openCnt), color: "#4d9cf5" },
            { label: "In Progress", value: String(inProgCnt), color: "#7c6aff" },
            { label: "Staging",     value: String(stagCnt), color: "#f0a030" },
            { label: "Archived",    value: String(archCnt), color: "#34d399" },
          ].map(s => (
            <div
              key={s.label}
              style={{
                flex: "1 1 72px", minWidth: "68px", padding: "10px 8px",
                borderRadius: "8px", background: `${s.color}0f`, border: `1px solid ${s.color}25`,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "20px", fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: "9px", color: "#6b7280", marginTop: "4px", lineHeight: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <Divider />

      {/* ── Velocity metrics ──────────────────────────────────── */}
      <div>
        <SLabel t="VELOCITY · HEALTH" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>

          {/* Avg resolution time */}
          <div
            style={{
              padding: "10px 12px", borderRadius: "8px",
              background: `${resColor}0c`, border: `1px solid ${resColor}22`,
            }}
          >
            <div style={{ fontSize: "9px", color: "#6b7280", marginBottom: "4px" }}>AVG RESOLUTION</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: resColor, lineHeight: 1 }}>
              {velocity.avgResolutionDays != null ? `${velocity.avgResolutionDays}d` : "—"}
            </div>
            <div style={{ fontSize: "9px", color: "#6b7280", marginTop: "3px" }}>created → staged</div>
          </div>

          {/* Avg open age */}
          <div
            style={{
              padding: "10px 12px", borderRadius: "8px",
              background: `${ageColor}0c`, border: `1px solid ${ageColor}22`,
            }}
          >
            <div style={{ fontSize: "9px", color: "#6b7280", marginBottom: "4px" }}>AVG OPEN AGE</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: ageColor, lineHeight: 1 }}>
              {velocity.avgAgeDays != null ? `${velocity.avgAgeDays}d` : "—"}
            </div>
            <div style={{ fontSize: "9px", color: "#6b7280", marginTop: "3px" }}>active issues</div>
          </div>

          {/* Net backlog (4 weeks) */}
          <div
            style={{
              padding: "10px 12px", borderRadius: "8px",
              background: `${backlogColor}0c`, border: `1px solid ${backlogColor}22`,
            }}
          >
            <div style={{ fontSize: "9px", color: "#6b7280", marginBottom: "4px" }}>NET BACKLOG · 4W</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: backlogColor, lineHeight: 1 }}>
              {backlogPrefix}{velocity.netBacklog}
            </div>
            <div style={{ fontSize: "9px", color: "#6b7280", marginTop: "3px" }}>
              {velocity.netBacklog < 0 ? "backlog shrinking ↓" : velocity.netBacklog === 0 ? "balanced" : "backlog growing ↑"}
            </div>
          </div>

          {/* Solution coverage */}
          <div
            style={{
              padding: "10px 12px", borderRadius: "8px",
              background: "rgba(124,106,255,0.07)", border: "1px solid rgba(124,106,255,0.2)",
            }}
          >
            <div style={{ fontSize: "9px", color: "#6b7280", marginBottom: "4px" }}>SOLUTION RATE</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#7c6aff", lineHeight: 1 }}>
              {velocity.solutionRate}%
            </div>
            <div style={{ fontSize: "9px", color: "#6b7280", marginTop: "3px" }}>issues with solutions</div>
          </div>
        </div>
      </div>

      <Divider />

      {/* ── Weekly activity chart ─────────────────────────────── */}
      <div>
        <SLabel t="ISSUE ACTIVITY · LAST 8 WEEKS" />
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={weeklyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradCreated"  x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f03a57" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f03a57" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradResolved" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#00cc7a" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#00cc7a" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#6b7280" }} />
            <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} allowDecimals={false} />
            <Tooltip {...TT} />
            <Area type="monotone" dataKey="Created"  stroke="#f03a57" fill="url(#gradCreated)"  strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="Resolved" stroke="#00cc7a" fill="url(#gradResolved)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginTop: "6px" }}>
          {[{ c: "#f03a57", l: "Created" }, { c: "#00cc7a", l: "Resolved" }].map(({ c, l }) => (
            <span key={l} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "9px", color: "#6b7280" }}>
              <span style={{ width: 12, height: 2, background: c, display: "inline-block", borderRadius: 1 }} />
              {l}
            </span>
          ))}
        </div>
      </div>

      {catData.length > 0 && <Divider />}

      {/* ── Category breakdown ────────────────────────────────── */}
      {catData.length > 0 && (
        <div>
          <SLabel t="ISSUE NATURE · BY CATEGORY" />
          <ResponsiveContainer width="100%" height={Math.max(80, catData.length * 30)}>
            <BarChart data={catData} layout="vertical" margin={{ top: 0, right: 8, left: 62, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 9, fill: "#6b7280" }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#8ea3be" }} width={58} />
              <Tooltip {...TT} />
              <Bar dataKey="Open"     stackId="a" fill="#4d9cf5" />
              <Bar dataKey="Resolved" stackId="a" fill="#34d399" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: "14px", justifyContent: "center", marginTop: "6px" }}>
            {[{ c: "#4d9cf5", l: "Open / In Progress" }, { c: "#34d399", l: "Resolved" }].map(({ c, l }) => (
              <span key={l} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "9px", color: "#6b7280" }}>
                <span style={{ width: 10, height: 10, background: c, display: "inline-block", borderRadius: 2 }} />
                {l}
              </span>
            ))}
          </div>
        </div>
      )}

      {prioData.length > 0 && <Divider />}

      {/* ── Priority distribution ─────────────────────────────── */}
      {prioData.length > 0 && (
        <div>
          <SLabel t="PRIORITY DISTRIBUTION" />
          <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
            {prioData.map(d => {
              const pct = Math.round((d.count / Math.max(total, 1)) * 100);
              return (
                <div key={d.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: d.color, width: "58px", flexShrink: 0 }}>
                    {d.label}
                  </span>
                  <div
                    style={{
                      flex: 1, height: "8px", borderRadius: "4px",
                      background: "rgba(255,255,255,0.05)", overflow: "hidden", position: "relative",
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`, height: "100%", background: d.color,
                        borderRadius: "4px", transition: "width 0.6s ease",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: "10px", color: d.color, fontWeight: 700, minWidth: "30px", textAlign: "right" }}>
                    {d.count} <span style={{ fontWeight: 400, color: "#6b7280" }}>({pct}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Issue card ──────────────────────────────────────────────── */
function IssueCard({
  issue, expanded, onToggle, canRecord, canResolve, solvingId, setSolvingId, onRefresh, onSetError,
  votedSolutions, onVote,
}: {
  issue: Issue; expanded: boolean; onToggle: () => void;
  canRecord: boolean; canResolve: boolean;
  solvingId: string | null; setSolvingId: (id: string | null) => void;
  onRefresh: () => void; onSetError: (err: string | null) => void;
  votedSolutions: Set<string>; onVote: (issueId: string, solutionId: string) => void;
}) {
  const p = issue.priority;
  const c = CAT[issue.category] ?? CAT.other;

  async function handleRaise() {
    const err = await callApi(`/api/session/issues/${issue.issue_id}/raise`, { method: "POST" });
    if (err) onSetError(err); else onRefresh();
  }

  return (
    <div
      style={{
        borderRadius: "7px",
        border:       "1px solid rgba(255,255,255,0.07)",
        background:   "rgba(255,255,255,0.025)",
        overflow:     "hidden",
        borderLeft:   `3px solid ${P_COLOR[p]}`,
      }}
    >
      {/* Collapsed header */}
      <div
        onClick={onToggle}
        style={{
          display:    "flex",
          alignItems: "center",
          gap:        "7px",
          padding:    "9px 12px",
          cursor:     "pointer",
          userSelect: "none",
        }}
      >
        <PriorityBadge p={p} />
        <span style={{ fontSize: "9px", color: c.color, flexShrink: 0 }}>{c.icon}</span>
        <span
          style={{
            flex: 1, fontSize: "13px", fontWeight: 500,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {issue.title}
        </span>
        {issue.sub_issues.length > 0 && (
          <span
            style={{
              fontSize: "9px", padding: "1px 5px", borderRadius: "3px",
              background: "rgba(77,156,245,0.12)", color: "#4d9cf5", flexShrink: 0,
            }}
          >
            {issue.sub_issues.length}↳
          </span>
        )}
        <span
          style={{
            fontSize: "9px", padding: "1px 6px", borderRadius: "3px", flexShrink: 0, fontWeight: 700,
            background: `${ST_COLOR[issue.status]}18`, color: ST_COLOR[issue.status],
          }}
        >
          {ST_LABEL[issue.status]}
        </span>
        {issue.raise_count > 0 && (
          <span style={{ fontSize: "10px", color: "#f0a030", flexShrink: 0 }}>↑{issue.raise_count}</span>
        )}
        <span style={{ fontSize: "10px", color: "#6b7280" }}>{expanded ? "▾" : "▸"}</span>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: "0 10px 10px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <RecordSection
            issue={issue}
            canRecord={canRecord}
            onRaise={handleRaise}
            onRefresh={onRefresh}
          />
          <ResolveSection
            issue={issue}
            canResolve={canResolve}
            canRecord={canRecord}
            solvingId={solvingId}
            setSolvingId={setSolvingId}
            onRefresh={onRefresh}
            onSetError={onSetError}
            votedSolutions={votedSolutions}
            onVote={onVote}
          />
        </div>
      )}
    </div>
  );
}

/* ── Create-issue form ───────────────────────────────────────── */
function CreateIssueForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    title:        "",
    description:  "",
    priority:     3,
    category:     "other" as Category,
    impact_score: 5,
    tags:         "",
  });
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!form.title.trim()) { setError("Title is required"); return; }
    setBusy(true);
    const tags = form.tags.split(",").map(t => t.trim()).filter(Boolean).slice(0, 10);
    const err  = await callApi("/api/session/issues", {
      method: "POST",
      body:   JSON.stringify({ ...form, tags }),
    });
    setBusy(false);
    if (err) { setError(err); return; }
    onDone();
  }

  const LBL: React.CSSProperties = {
    fontSize: "10px", fontWeight: 700, color: "#6b7280",
    letterSpacing: "0.5px", marginBottom: "4px", display: "block",
  };
  const FIELD: React.CSSProperties = { ...INPUT, fontSize: "13px", padding: "8px 10px" };

  return (
    <div
      style={{
        padding:       "16px",
        display:       "flex",
        flexDirection: "column",
        gap:           "12px",
        borderBottom:  "1px solid rgba(255,255,255,0.07)",
        background:    "rgba(0,204,122,0.03)",
      }}
    >
      <div style={{ fontSize: "13px", fontWeight: 700 }}>Report Issue</div>

      {error && (
        <div
          style={{
            padding: "7px 10px", borderRadius: "5px",
            background: "rgba(240,58,87,0.12)", border: "1px solid rgba(240,58,87,0.25)",
            fontSize: "12px", color: "#f03a57", display: "flex", justifyContent: "space-between",
          }}
        >
          {error}
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#f03a57", cursor: "pointer" }}>✕</button>
        </div>
      )}

      <div>
        <label style={LBL}>TITLE *</label>
        <input
          style={FIELD}
          placeholder="Brief description of the issue"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          maxLength={200}
        />
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <div style={{ flex: 1 }}>
          <label style={LBL}>CATEGORY</label>
          <select
            style={{ ...SELECT, fontSize: "13px", padding: "8px 26px 8px 10px" }}
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}
          >
            {(Object.entries(CAT) as [Category, (typeof CAT)[Category]][]).map(([k, v]) => (
              <option key={k} value={k} style={OPT}>{v.icon} {v.label}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={LBL}>PRIORITY</label>
          <select
            style={{ ...SELECT, fontSize: "13px", padding: "8px 26px 8px 10px" }}
            value={form.priority}
            onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))}
          >
            {P_LABEL.map((l, i) => <option key={i} value={i} style={OPT}>{l}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label style={LBL}>IMPACT SCORE: {form.impact_score}/10</label>
        <input
          type="range"
          min={1}
          max={10}
          value={form.impact_score}
          onChange={e => setForm(f => ({ ...f, impact_score: Number(e.target.value) }))}
          style={{ width: "100%", accentColor: "#f03a57" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#6b7280", marginTop: "2px" }}>
          <span>Negligible</span><span>Critical</span>
        </div>
      </div>

      <div>
        <label style={LBL}>DESCRIPTION</label>
        <textarea
          style={{ ...FIELD, resize: "vertical" }}
          placeholder="Detailed description of the problem…"
          rows={3}
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          maxLength={2000}
        />
      </div>

      <div>
        <label style={LBL}>TAGS (comma-separated)</label>
        <input
          style={FIELD}
          placeholder="e.g. latency, position-sizing, memory"
          value={form.tags}
          onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
        />
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={submit}
          disabled={busy}
          style={{
            flex: 1, padding: "9px", borderRadius: "6px",
            border: "1px solid rgba(0,204,122,0.4)",
            background: "rgba(0,204,122,0.14)",
            color: "#00cc7a", fontWeight: 700, fontSize: "13px", cursor: "pointer",
          }}
        >
          {busy ? "Reporting…" : "Report Issue"}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "9px 14px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)",
            background: "none", color: "#6b7280", fontSize: "13px", cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── Main IssuePanel ─────────────────────────────────────────── */
export default function IssuePanel({ showInsight = false }: { showInsight?: boolean }) {
  const { data: session }               = useSession();
  const [open,           setOpen]           = useState(false);
  const [tab,            setTab]            = useState<TabFilter>("open");
  const [issues,         setIssues]         = useState<Issue[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [apiError,       setApiError]       = useState<string | null>(null);
  const [expandedId,     setExpandedId]     = useState<string | null>(null);
  const [creating,       setCreating]       = useState(false);
  const [solvingId,      setSolvingId]      = useState<string | null>(null);
  const [votedSolutions, setVotedSolutions] = useState<Set<string>>(new Set());

  const roles: string[] = (session as any)?.roles ?? [];
  const canRecord  = roles.some(r => ["operator", "analyst", "strategist", "fund_manager"].includes(r));
  const canResolve = roles.some(r => ["strategist", "fund_manager"].includes(r));
  const roleLabel  = canResolve ? "RESOLVER" : canRecord ? "RECORDER" : "VIEWER";
  const roleColor  = canResolve ? "#00cc7a"  : canRecord ? "#4d9cf5"  : "#6b7280";

  const loadIssues = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/session/issues");
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setApiError((j as any)?.error ?? "Failed to load issues");
        return;
      }
      setIssues(await r.json());
    } catch {
      setApiError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleVote(issueId: string, solutionId: string) {
    setVotedSolutions(prev => new Set([...prev, solutionId]));
    const err = await callApi(`/api/session/issues/${issueId}/solution/vote`, { method: "POST" });
    if (err) {
      setApiError(err);
      setVotedSolutions(prev => { const s = new Set(prev); s.delete(solutionId); return s; });
    } else {
      loadIssues();
    }
  }

  useEffect(() => {
    if (open) loadIssues();
  }, [open, loadIssues]);

  const filtered = useMemo(() => {
    if (tab === "open")     return issues.filter(i => i.status === "open" || i.status === "in_progress");
    if (tab === "staging")  return issues.filter(i => i.status === "staging");
    if (tab === "archived") return issues.filter(i => i.status === "archived");
    return issues;
  }, [issues, tab]);

  const openCnt    = issues.filter(i => i.status === "open" || i.status === "in_progress").length;
  const stagingCnt = issues.filter(i => i.status === "staging").length;

  function TabBtn({ k, label, badge }: { k: TabFilter; label: string; badge?: number }) {
    const active = tab === k;
    return (
      <button
        onClick={() => setTab(k)}
        style={{
          padding:       "5px 11px",
          borderRadius:  "5px",
          background:    active ? "rgba(255,255,255,0.1)" : "none",
          border:        "none",
          color:         active ? "var(--fg)" : "#6b7280",
          fontSize:      "11px",
          fontWeight:    active ? 700 : 400,
          cursor:        "pointer",
          whiteSpace:    "nowrap",
          display:       "inline-flex",
          alignItems:    "center",
          gap:           "4px",
        }}
      >
        {label}
        {badge !== undefined && badge > 0 && (
          <span
            style={{
              padding:      "0 5px",
              borderRadius: "8px",
              fontSize:     "9px",
              fontWeight:   700,
              background:   k === "open" ? "#f03a57" : "#f0a030",
              color:        "#fff",
            }}
          >
            {badge}
          </span>
        )}
      </button>
    );
  }

  return (
    <>
      <style>{`
        @keyframes pulse-red { 0%,100%{opacity:1}50%{opacity:0.5} }
        .iss-scroll::-webkit-scrollbar{width:4px}
        .iss-scroll::-webkit-scrollbar-track{background:transparent}
        .iss-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px}
      `}</style>

      {/* Floating action button */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Toggle issue panel"
        style={{
          position:       "fixed",
          bottom:         28,
          right:          28,
          zIndex:         900,
          width:          50,
          height:         50,
          borderRadius:   "50%",
          background:     canResolve
            ? "linear-gradient(135deg,#00cc7a,#00a060)"
            : "linear-gradient(135deg,#f03a57,#c02040)",
          border:         "none",
          color:          "#fff",
          fontSize:       "20px",
          cursor:         "pointer",
          boxShadow:      "0 4px 18px rgba(0,0,0,0.4)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
        }}
      >
        {open ? "×" : "⚑"}
        {!open && openCnt > 0 && (
          <span
            style={{
              position:       "absolute",
              top:            2,
              right:          2,
              width:          18,
              height:         18,
              borderRadius:   "50%",
              background:     "#f03a57",
              color:          "#fff",
              fontSize:       "9px",
              fontWeight:     700,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              border:         "2px solid var(--bg,#12121a)",
            }}
          >
            {openCnt > 99 ? "99+" : openCnt}
          </span>
        )}
      </button>

      {/* Insight overlay panel — wide panel to the left of the issues panel */}
      {open && tab === "insight" && showInsight && canResolve && (
        <div
          style={{
            position:      "fixed",
            top:           0,
            right:         "min(480px,100vw)",
            bottom:        0,
            left:          0,
            zIndex:        898,
            background:    "var(--surface,#1a1a2e)",
            borderRight:   "1px solid rgba(255,255,255,0.06)",
            boxShadow:     "-4px 0 40px rgba(0,0,0,0.5)",
            display:       "flex",
            flexDirection: "column",
          }}
        >
          {/* Insight header */}
          <div
            style={{
              padding:      "14px 18px",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              flexShrink:   0,
              display:      "flex",
              alignItems:   "center",
              gap:          "10px",
            }}
          >
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#8ea3be" }}>Issue Analytics</span>
            <span
              style={{
                padding:      "2px 8px",
                borderRadius: "4px",
                fontSize:     "9px",
                fontWeight:   700,
                background:   "rgba(124,106,255,0.12)",
                color:        "#7c6aff",
                letterSpacing: "0.4px",
              }}
            >
              {issues.length} ISSUES
            </span>
          </div>
          <div className="iss-scroll" style={{ flex: 1, overflowY: "auto" }}>
            <InsightTab issues={issues} />
          </div>
        </div>
      )}

      {/* Side panel */}
      {open && (
        <div
          style={{
            position:      "fixed",
            top:           0,
            right:         0,
            bottom:        0,
            zIndex:        899,
            width:         "min(480px,100vw)",
            background:    "var(--surface,#1a1a2e)",
            borderLeft:    "1px solid rgba(255,255,255,0.07)",
            boxShadow:     "-4px 0 36px rgba(0,0,0,0.45)",
            display:       "flex",
            flexDirection: "column",
          }}
        >
          {/* Panel header */}
          <div
            style={{
              padding:      "15px 15px 0",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              flexShrink:   0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "11px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "15px", fontWeight: 700 }}>Issues</span>
                <span
                  style={{
                    padding:       "2px 8px",
                    borderRadius:  "4px",
                    fontSize:      "9px",
                    fontWeight:    700,
                    background:    `${roleColor}18`,
                    color:         roleColor,
                    letterSpacing: "0.5px",
                  }}
                >
                  {roleLabel}
                </span>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                {canRecord && !creating && (
                  <button
                    onClick={() => setCreating(true)}
                    style={{
                      padding:      "4px 10px",
                      borderRadius: "5px",
                      border:       "1px solid rgba(0,204,122,0.3)",
                      background:   "rgba(0,204,122,0.09)",
                      color:        "#00cc7a",
                      fontSize:     "11px",
                      cursor:       "pointer",
                      fontWeight:   600,
                    }}
                  >
                    + Report
                  </button>
                )}
                <button
                  onClick={loadIssues}
                  disabled={loading}
                  style={{
                    padding:      "4px 10px",
                    borderRadius: "5px",
                    border:       "1px solid rgba(255,255,255,0.09)",
                    background:   "none",
                    color:        "#6b7280",
                    fontSize:     "11px",
                    cursor:       "pointer",
                  }}
                >
                  {loading ? "…" : "↻"}
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: "2px", paddingBottom: "8px", overflowX: "auto" }}>
              <TabBtn k="open"     label="Active"   badge={openCnt} />
              <TabBtn k="staging"  label="Staging"  badge={stagingCnt} />
              <TabBtn k="archived" label="Archived" />
              {showInsight && canResolve && (
                <TabBtn k="insight" label="Insight ↗" />
              )}
            </div>
          </div>

          {/* Error banner */}
          {apiError && (
            <div
              style={{
                padding:        "7px 14px",
                background:     "rgba(240,58,87,0.1)",
                borderBottom:   "1px solid rgba(240,58,87,0.18)",
                color:          "#f03a57",
                fontSize:       "12px",
                display:        "flex",
                justifyContent: "space-between",
                alignItems:     "center",
                flexShrink:     0,
              }}
            >
              {apiError}
              <button
                onClick={() => setApiError(null)}
                style={{ background: "none", border: "none", color: "#f03a57", cursor: "pointer", fontSize: "14px" }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Scrollable body */}
          <div className="iss-scroll" style={{ flex: 1, overflowY: "auto" }}>
            {creating && (
              <CreateIssueForm
                onDone={() => { setCreating(false); loadIssues(); }}
                onCancel={() => setCreating(false)}
              />
            )}

            {tab === "insight" && showInsight && canResolve ? (
              <div style={{ textAlign: "center", padding: "52px 20px", color: "#6b7280", fontSize: "12px", lineHeight: 1.7 }}>
                <div style={{ fontSize: "22px", marginBottom: "8px" }}>↔</div>
                Analytics panel open to the left
              </div>
            ) : loading ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#6b7280", fontSize: "13px" }}>
                Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#6b7280", fontSize: "13px" }}>
                {tab === "open"     ? "No active issues"
                : tab === "staging" ? "No issues in staging"
                :                    "No archived issues"}
              </div>
            ) : (
              <div style={{ padding: "12px 11px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {filtered.map(issue => (
                  <IssueCard
                    key={issue.issue_id}
                    issue={issue}
                    expanded={expandedId === issue.issue_id}
                    onToggle={() => setExpandedId(v => v === issue.issue_id ? null : issue.issue_id)}
                    canRecord={canRecord}
                    canResolve={canResolve}
                    solvingId={solvingId}
                    setSolvingId={setSolvingId}
                    onRefresh={loadIssues}
                    onSetError={setApiError}
                    votedSolutions={votedSolutions}
                    onVote={handleVote}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
