"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { KMS_STATUS_META, toKmsStatus, taxonomyLabels } from "@/lib/kms";
import TriageReportForm from "@/components/issues/kms/TriageReportForm";
import KmsDashboard     from "@/components/issues/kms/KmsDashboard";
import ToolRegistry     from "@/components/issues/kms/ToolRegistry";

/* ── Types ───────────────────────────────────────────────────── */
type IssueStatus = "open" | "in_progress" | "staging" | "archived";
type TabFilter   = "open" | "staging" | "archived" | "tools" | "insight";
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
  solution_endorsements:  number;
  solution_disregards:    number;
  observed_week_1:        string | null;
  observed_week_2:        string | null;
  observed_week_3:        string | null;
  all_observed_at:        string | null;
  scratched_solutions:    ScratchedSolution[];
  sub_issues:             SubIssue[];
  /* KMS survivability pipeline */
  kms_status?:            string | null;
  domain?:                string | null;
  subsystem?:             string | null;
  leaf_node?:             string | null;
  oos_started_at?:        string | null;
  oos_sessions?:          number;
  oos_sessions_required?: number;
  baseline_at?:           string | null;
  deployments?: {
    deployment_id: number;
    tool_id:       string;
    tool_name:     string;
    tool_version:  string;
    tool_category: string;
    deployed_at:   string;
    deployed_by:   string;
    active:        boolean;
    relapses:      number;
  }[];
}

/* ── Constants ───────────────────────────────────────────────── */
const P_LABEL = ["DIRE", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;
const P_COLOR = ["#f03a57", "#f03a57", "#f0a030", "#eab308", "#4d9cf5", "var(--ink-1,#9ab0c8)"] as const;
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
  other:      { label: "Other",      icon: "○",  color: "var(--ink-2,#5a7490)" },
};

const ST_COLOR: Record<IssueStatus, string> = {
  open:        "var(--ink-2,#5a7490)",
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
  background:   "var(--sub,#07101c)",
  border:       "1px solid var(--line-hi,rgba(255,255,255,0.11))",
  borderRadius: "5px",
  color:        "var(--ink-0,#eef2f8)",
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
const OPT: React.CSSProperties = { background: "var(--card,#0b1622)", color: "var(--ink-1,#9ab0c8)" };

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
      <span style={{ fontSize: "9px", color: "var(--ink-2,#5a7490)", flexShrink: 0 }}>Impact</span>
      <div
        style={{ flex: 1, height: "4px", borderRadius: "2px", background: "var(--line-hi,rgba(255,255,255,0.11))", overflow: "hidden" }}
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
        background:   done ? "rgba(0,204,122,0.12)" : "var(--raised,#0f1e2e)",
        color:        done ? "#00cc7a" : "var(--ink-2,#5a7490)",
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
        background:   "var(--raised,#0f1e2e)",
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
        borderLeft:    "3px solid var(--blue,#4d9cf5)",
        borderRadius:  "0 6px 6px 0",
        background:    "var(--sub,#07101c)",
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
              background:   "var(--raised,#0f1e2e)",
              color:        "var(--ink-2,#5a7490)",
              border:       "1px solid var(--line,rgba(255,255,255,0.06))",
            }}
          >
            #{tag}
          </span>
        ))}
      </div>

      {/* Description */}
      {issue.description && (
        <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.6, color: "var(--ink-1,#9ab0c8)", whiteSpace: "pre-wrap" }}>
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
            background:    "var(--raised,#0f1e2e)",
            border:        "1px solid var(--line-hi,rgba(255,255,255,0.11))",
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
                padding: "5px 10px", borderRadius: "4px", border: "1px solid var(--line-hi,rgba(255,255,255,0.11))",
                background: "none", color: "var(--ink-2,#5a7490)", fontSize: "11px", cursor: "pointer",
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
            border:       "1px solid var(--line-hi,rgba(255,255,255,0.11))",
            background:   "var(--sub,#07101c)",
            color:        "var(--ink-2,#5a7490)",
            fontSize:     "11px",
            cursor:       canRecord ? "pointer" : "default",
            opacity:      canRecord ? 1 : 0.4,
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
              border:       "1px solid rgba(77,156,245,0.22)",
              background:   "var(--sub,#07101c)",
              color:        "var(--blue,#4d9cf5)",
              fontSize:     "11px",
              cursor:       "pointer",
              fontWeight:   500,
            }}
          >
            + Sub-issue
          </button>
        )}
        <span style={{ fontSize: "10px", color: "var(--ink-2,#5a7490)" }}>{timeAgo(issue.created_at)}</span>
      </div>
    </div>
  );
}

/* ── RESOLVE section ─────────────────────────────────────────── */
function ResolveSection({
  issue, canResolve, canManage, canRecord, solvingId, setSolvingId, onRefresh, onSetError,
  endorsedSolutions, disregardedSolutions, onEndorse, onDisregard,
}: {
  issue: Issue;
  canResolve: boolean;
  canManage: boolean;
  canRecord: boolean;
  solvingId: string | null;
  setSolvingId: (id: string | null) => void;
  onRefresh: () => void;
  onSetError: (err: string | null) => void;
  endorsedSolutions: Set<string>;
  disregardedSolutions: Set<string>;
  onEndorse: (issueId: string, solutionId: string) => void;
  onDisregard: (issueId: string, solutionId: string) => void;
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
        borderLeft:    "3px solid var(--green,#00cc7a)",
        borderRadius:  "0 6px 6px 0",
        background:    "var(--sub,#07101c)",
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
          <span style={{ fontWeight: 400, color: "var(--ink-2,#5a7490)", marginLeft: "6px" }}>
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
        <p style={{ margin: 0, fontSize: "12px", color: "var(--ink-2,#5a7490)", fontStyle: "italic" }}>
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
                padding: "5px 10px", borderRadius: "4px", border: "1px solid var(--line-hi,rgba(255,255,255,0.11))",
                background: "none", color: "var(--ink-2,#5a7490)", fontSize: "11px", cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active solution card — shown even when issue is archived (solution can remain on-going) */}
      {issue.solution_description && !isSolving && (
        <div
          style={{
            padding:       "8px 10px",
            borderRadius:  "5px",
            background:    "var(--raised,#0f1e2e)",
            border:        "1px solid var(--line,rgba(255,255,255,0.06))",
            display:       "flex",
            flexDirection: "column",
            gap:           "8px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
            <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.6, color: "var(--ink-1,#9ab0c8)", flex: 1 }}>
              {issue.solution_description}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", flexShrink: 0, alignItems: "flex-end" }}>
              {!canResolve && canRecord && issue.solution_id && (() => {
                const endorsed    = endorsedSolutions.has(issue.solution_id!);
                const disregarded = disregardedSolutions.has(issue.solution_id!);
                const actioned    = endorsed || disregarded;
                return (
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      onClick={() => { if (!actioned && issue.solution_id) onEndorse(issue.issue_id, issue.solution_id); }}
                      disabled={busy || actioned}
                      title={endorsed ? "You've endorsed this solution" : "Endorse this solution"}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: "4px",
                        padding: "2px 8px", borderRadius: "4px",
                        border: `1px solid ${endorsed ? "rgba(0,204,122,0.5)" : "rgba(0,204,122,0.25)"}`,
                        background: endorsed ? "rgba(0,204,122,0.18)" : "rgba(0,204,122,0.06)",
                        color: "#00cc7a", fontSize: "10px",
                        cursor: actioned ? "default" : "pointer", fontWeight: 700,
                        opacity: disregarded ? 0.4 : 1,
                      }}
                    >
                      ✓ {issue.solution_endorsements}
                    </button>
                    <button
                      onClick={() => { if (!actioned && issue.solution_id) onDisregard(issue.issue_id, issue.solution_id); }}
                      disabled={busy || actioned}
                      title={disregarded ? "You've disregarded this solution" : "Disregard this solution"}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: "4px",
                        padding: "2px 8px", borderRadius: "4px",
                        border: `1px solid ${disregarded ? "rgba(240,58,87,0.5)" : "rgba(240,58,87,0.25)"}`,
                        background: disregarded ? "rgba(240,58,87,0.18)" : "rgba(240,58,87,0.06)",
                        color: "#f03a57", fontSize: "10px",
                        cursor: actioned ? "default" : "pointer", fontWeight: 700,
                        opacity: endorsed ? 0.4 : 1,
                      }}
                    >
                      ✗ {issue.solution_disregards}
                    </button>
                  </div>
                );
              })()}
              {canManage && !isStaging && (
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
            <div style={{ fontSize: "9px", color: "var(--ink-2,#5a7490)", fontWeight: 700, marginBottom: "6px", letterSpacing: "0.4px" }}>
              OBSERVED RESOLVE
            </div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <ObsBox
                done={!!issue.observed_week_1}
                label="Week 1"
                onClick={canManage && !issue.observed_week_1
                  ? () => run(() => callApi(`/api/session/issues/${issue.issue_id}/observe`, {
                      method: "PATCH", body: JSON.stringify({ week: 1 }),
                    }))
                  : undefined}
              />
              <ObsBox
                done={!!issue.observed_week_2}
                label="Week 2"
                onClick={canManage && !issue.observed_week_2 && !!issue.observed_week_1
                  ? () => run(() => callApi(`/api/session/issues/${issue.issue_id}/observe`, {
                      method: "PATCH", body: JSON.stringify({ week: 2 }),
                    }))
                  : undefined}
              />
              <ObsBox
                done={!!issue.observed_week_3}
                label="Week 3"
                onClick={canManage && !issue.observed_week_3 && !!issue.observed_week_2
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
              background: "none", border: "none", color: "var(--ink-2,#5a7490)",
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
                    background: "var(--raised,#0f1e2e)", border: "1px solid var(--line,rgba(255,255,255,0.06))",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "11px", color: "var(--ink-2,#5a7490)", textDecoration: "line-through", lineHeight: 1.5 }}>
                    {s.description}
                  </p>
                  <div style={{ fontSize: "9px", color: "var(--ink-3,#2a3d52)", marginTop: "3px" }}>
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
        {canManage && !isArchived && !isSolving && (
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

        {canManage && !isArchived && !isStaging && !closeForm && (
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

        {canManage && (isStaging || isArchived) && !reopenForm && (
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
                  padding: "5px 10px", borderRadius: "4px", border: "1px solid var(--line-hi,rgba(255,255,255,0.11))",
                  background: "none", color: "var(--ink-2,#5a7490)", fontSize: "11px", cursor: "pointer",
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
                  padding: "5px 10px", borderRadius: "4px", border: "1px solid var(--line-hi,rgba(255,255,255,0.11))",
                  background: "none", color: "var(--ink-2,#5a7490)", fontSize: "11px", cursor: "pointer",
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
  const now       = Date.now();
  const total     = issues.length;
  const openCnt   = issues.filter(i => i.status === "open" || i.status === "in_progress").length;
  const stagCnt   = issues.filter(i => i.status === "staging").length;
  const archCnt   = issues.filter(i => i.status === "archived").length;
  const inProgCnt = issues.filter(i => i.status === "in_progress").length;
  const pureOpenCnt = issues.filter(i => i.status === "open").length;

  /* ── Velocity metrics ─────────────────────────────────────────── */
  const velocity = useMemo(() => {
    const resolved = issues.filter(i => i.staging_at || i.closed_at);
    const avgResolutionDays = resolved.length > 0
      ? Math.round(resolved.reduce((sum, i) => {
          const end = i.closed_at ? new Date(i.closed_at).getTime() : new Date(i.staging_at!).getTime();
          return sum + (end - new Date(i.created_at).getTime()) / 86_400_000;
        }, 0) / resolved.length)
      : null;

    const open = issues.filter(i => i.status === "open" || i.status === "in_progress");
    const avgAgeDays = open.length > 0
      ? Math.round(open.reduce((sum, i) => sum + (now - new Date(i.created_at).getTime()) / 86_400_000, 0) / open.length)
      : null;

    const fourWeeksAgo   = now - 4 * 7 * 86_400_000;
    const recentCreated  = issues.filter(i => new Date(i.created_at).getTime() >= fourWeeksAgo).length;
    const recentResolved = issues.filter(i => {
      const t = i.closed_at ? new Date(i.closed_at).getTime() : i.staging_at ? new Date(i.staging_at).getTime() : 0;
      return t >= fourWeeksAgo;
    }).length;
    const netBacklog = recentCreated - recentResolved;

    const withSolution  = issues.filter(i => i.solution_id || i.status === "staging" || i.status === "archived").length;
    const solutionRate  = total > 0 ? Math.round((withSolution / total) * 100) : 0;
    const reopenedCount = issues.filter(i => i.reopen_count > 0).length;

    return { avgResolutionDays, avgAgeDays, netBacklog, solutionRate, reopenedCount };
  }, [issues, now, total]);

  /* ── Weekly activity ──────────────────────────────────────────── */
  const weeklyData = useMemo(() => {
    const MS_WEEK = 7 * 86_400_000;
    return Array.from({ length: 8 }, (_, wi) => {
      const wStart = now - (7 - wi) * MS_WEEK;
      const wEnd   = wStart + MS_WEEK;
      const label  = new Date(wStart).toLocaleDateString("en-AU", { month: "short", day: "numeric" });
      return {
        label,
        Created:  issues.filter(i => { const t = new Date(i.created_at).getTime(); return t >= wStart && t < wEnd; }).length,
        Resolved: issues.filter(i => {
          const t = i.closed_at ? new Date(i.closed_at).getTime() : i.staging_at ? new Date(i.staging_at).getTime() : 0;
          return t > 0 && t >= wStart && t < wEnd;
        }).length,
      };
    });
  }, [issues, now]);

  /* ── Category breakdown ───────────────────────────────────────── */
  const catData = useMemo(() => {
    const map = new Map<Category, { open: number; resolved: number }>();
    for (const k of Object.keys(CAT) as Category[]) map.set(k, { open: 0, resolved: 0 });
    for (const i of issues) {
      const k = (CAT[i.category] ? i.category : "other") as Category;
      const e = map.get(k)!;
      if (i.status === "open" || i.status === "in_progress") e.open++; else e.resolved++;
    }
    return [...map.entries()]
      .map(([k, v]) => ({ name: CAT[k].label, Open: v.open, Resolved: v.resolved, total: v.open + v.resolved, color: CAT[k].color }))
      .filter(d => d.total > 0).sort((a, b) => b.total - a.total);
  }, [issues]);

  /* ── Priority distribution ────────────────────────────────────── */
  const prioData = useMemo(() =>
    [0, 1, 2, 3, 4, 5].map(p => ({ label: P_LABEL[p], count: issues.filter(i => i.priority === p).length, color: P_COLOR[p] }))
      .filter(d => d.count > 0),
    [issues]
  );

  /* ── Open issue age buckets ───────────────────────────────────── */
  const ageBucketData = useMemo(() => {
    const open = issues.filter(i => i.status === "open" || i.status === "in_progress");
    const buckets = [
      { label: "<1d",  min: 0,   max: 1,    color: "#00cc7a" },
      { label: "1-7d", min: 1,   max: 7,    color: "#34d399" },
      { label: "1-4w", min: 7,   max: 28,   color: "#f0a030" },
      { label: "1-3m", min: 28,  max: 90,   color: "#f03a57" },
      { label: ">3m",  min: 90,  max: Infinity, color: "#a855f7" },
    ];
    return buckets.map(b => ({
      label: b.label,
      Count: open.filter(i => {
        const d = (now - new Date(i.created_at).getTime()) / 86_400_000;
        return d >= b.min && d < b.max;
      }).length,
      color: b.color,
    })).filter(b => b.Count > 0);
  }, [issues, now]);

  /* ── Most raised issues ───────────────────────────────────────── */
  const topRaisedData = useMemo(() =>
    [...issues]
      .filter(i => i.raise_count > 0)
      .sort((a, b) => b.raise_count - a.raise_count)
      .slice(0, 7)
      .map(i => ({
        name:   i.title.length > 28 ? i.title.slice(0, 26) + "…" : i.title,
        Raises: i.raise_count,
        color:  P_COLOR[i.priority],
      })),
    [issues]
  );

  /* ── Reporter activity ────────────────────────────────────────── */
  const reporterData = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of issues) {
      const r = shortEmail(i.reported_by);
      map.set(r, (map.get(r) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([name, Issues]) => ({ name, Issues }))
      .sort((a, b) => b.Issues - a.Issues)
      .slice(0, 6);
  }, [issues]);

  /* ── Status donut data ────────────────────────────────────────── */
  const donutData = [
    { name: "Open",        value: pureOpenCnt, color: "#4d9cf5" },
    { name: "In Progress", value: inProgCnt,   color: "#7c6aff" },
    { name: "Staging",     value: stagCnt,     color: "#f0a030" },
    { name: "Archived",    value: archCnt,     color: "#34d399" },
  ].filter(d => d.value > 0);

  /* ── Shared tooltip style ─────────────────────────────────────── */
  const TT = {
    contentStyle: {
      background: "var(--card,#0b1622)", border: "1px solid var(--line-hi,rgba(255,255,255,0.11))",
      borderRadius: "6px", color: "#d0d4e0", fontSize: "11px", padding: "5px 9px",
    },
  };

  function Divider() {
    return <div style={{ height: "1px", background: "rgba(255,255,255,0.06)" }} />;
  }

  function SLabel({ t }: { t: string }) {
    return (
      <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--ink-2,#5a7490)", marginBottom: "10px", letterSpacing: "0.6px" }}>
        {t}
      </div>
    );
  }

  const backlogColor  = velocity.netBacklog < 0 ? "#00cc7a" : velocity.netBacklog === 0 ? "var(--ink-2,#5a7490)" : "#f03a57";
  const backlogPrefix = velocity.netBacklog > 0 ? "+" : "";
  const resColor = velocity.avgResolutionDays == null ? "var(--ink-2,#5a7490)"
    : velocity.avgResolutionDays <= 7 ? "#00cc7a" : velocity.avgResolutionDays <= 21 ? "#f0a030" : "#f03a57";
  const ageColor = velocity.avgAgeDays == null ? "var(--ink-2,#5a7490)"
    : velocity.avgAgeDays <= 14 ? "#00cc7a" : velocity.avgAgeDays <= 30 ? "#f0a030" : "#f03a57";

  if (total === 0) {
    return <div style={{ textAlign: "center", color: "var(--ink-2,#5a7490)", fontSize: "13px", padding: "60px 0" }}>No issue data yet</div>;
  }

  const G2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" };
  const G3: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "18px" };

  return (
    <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "22px" }}>

      {/* ── Status tiles ────────────────────────────────────────── */}
      <div style={G3}>
        {[
          { label: "Total Issues",  value: total,                  color: "var(--ink-1,#9ab0c8)" },
          { label: "Open",          value: pureOpenCnt,            color: "#4d9cf5" },
          { label: "In Progress",   value: inProgCnt,              color: "#7c6aff" },
          { label: "Staging",       value: stagCnt,                color: "#f0a030" },
          { label: "Archived",      value: archCnt,                color: "#34d399" },
          { label: "Ever Reopened", value: velocity.reopenedCount, color: "#f03a57" },
        ].map(s => (
          <div key={s.label} style={{ padding: "12px 14px", borderRadius: "10px", background: `${s.color}0d`, border: `1px solid ${s.color}28` }}>
            <div style={{ fontSize: "26px", fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: "10px", color: "var(--ink-2,#5a7490)", marginTop: "5px" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <Divider />

      {/* ── KPI row (4 cards) + donut ───────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: "18px", alignItems: "start" }}>
        <div>
          <SLabel t="VELOCITY · HEALTH" />
          <div style={G2}>
            {[
              { label: "AVG RESOLUTION", value: velocity.avgResolutionDays != null ? `${velocity.avgResolutionDays}d` : "—", sub: "created → staged", color: resColor },
              { label: "AVG OPEN AGE",   value: velocity.avgAgeDays != null ? `${velocity.avgAgeDays}d` : "—",              sub: "active issues",    color: ageColor },
              { label: "NET BACKLOG 4W", value: `${backlogPrefix}${velocity.netBacklog}`, sub: velocity.netBacklog < 0 ? "shrinking ↓" : velocity.netBacklog === 0 ? "balanced" : "growing ↑", color: backlogColor },
              { label: "SOLUTION RATE",  value: `${velocity.solutionRate}%`,              sub: "issues with solutions", color: "#7c6aff" },
            ].map(k => (
              <div key={k.label} style={{ padding: "11px 13px", borderRadius: "8px", background: `${k.color}0c`, border: `1px solid ${k.color}22` }}>
                <div style={{ fontSize: "9px", color: "var(--ink-2,#5a7490)", marginBottom: "4px", letterSpacing: "0.4px" }}>{k.label}</div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: k.color, lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: "9px", color: "var(--ink-2,#5a7490)", marginTop: "4px" }}>{k.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SLabel t="STATUS SPLIT" />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <PieChart width={120} height={120}>
              <Pie
                data={donutData} cx={56} cy={56}
                innerRadius={32} outerRadius={52}
                paddingAngle={3} dataKey="value"
                strokeWidth={0} label={false}
              >
                {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip {...TT} />
            </PieChart>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px", width: "100%" }}>
              {donutData.map(d => (
                <div key={d.name} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: d.color, flexShrink: 0, display: "inline-block" }} />
                  <span style={{ fontSize: "10px", color: "var(--ink-1,#9ab0c8)", flex: 1 }}>{d.name}</span>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: d.color }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Divider />

      {/* ── Weekly activity (full width) ─────────────────────────── */}
      <div>
        <SLabel t="ISSUE ACTIVITY · LAST 8 WEEKS" />
        <ResponsiveContainer width="100%" height={148}>
          <AreaChart data={weeklyData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="gradCreated"  x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f03a57" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#f03a57" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradResolved" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#00cc7a" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#00cc7a" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--ink-2,#5a7490)" }} />
            <YAxis tick={{ fontSize: 9, fill: "var(--ink-2,#5a7490)" }} allowDecimals={false} />
            <Tooltip {...TT} />
            <Area type="monotone" dataKey="Created"  stroke="#f03a57" fill="url(#gradCreated)"  strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="Resolved" stroke="#00cc7a" fill="url(#gradResolved)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginTop: "6px" }}>
          {[{ c: "#f03a57", l: "Created" }, { c: "#00cc7a", l: "Resolved" }].map(({ c, l }) => (
            <span key={l} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "9px", color: "var(--ink-2,#5a7490)" }}>
              <span style={{ width: 12, height: 2, background: c, display: "inline-block", borderRadius: 1 }} />{l}
            </span>
          ))}
        </div>
      </div>

      <Divider />

      {/* ── Age buckets + Category ───────────────────────────────── */}
      <div style={G2}>
        {ageBucketData.length > 0 ? (
          <div>
            <SLabel t="OPEN ISSUE AGE BUCKETS" />
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={ageBucketData} margin={{ top: 4, right: 12, left: -18, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--ink-2,#5a7490)" }} />
                <YAxis tick={{ fontSize: 9, fill: "var(--ink-2,#5a7490)" }} allowDecimals={false} />
                <Tooltip {...TT} />
                <Bar dataKey="Count" maxBarSize={52} radius={[5, 5, 0, 0]}>
                  {ageBucketData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ fontSize: "9px", color: "var(--ink-2,#5a7490)", textAlign: "center", marginTop: "4px" }}>staleness of open issues</div>
          </div>
        ) : (
          <div>
            <SLabel t="OPEN ISSUE AGE BUCKETS" />
            <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-2,#5a7490)", fontSize: "12px", fontStyle: "italic" }}>
              No open issues
            </div>
          </div>
        )}

        {catData.length > 0 ? (
          <div>
            <SLabel t="ISSUE NATURE · BY CATEGORY" />
            <ResponsiveContainer width="100%" height={Math.max(140, catData.length * 26)}>
              <BarChart data={catData} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: "var(--ink-2,#5a7490)" }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "var(--ink-1,#9ab0c8)" }} width={70} />
                <Tooltip {...TT} />
                <Bar dataKey="Open"     stackId="a" fill="#4d9cf5" maxBarSize={16} />
                <Bar dataKey="Resolved" stackId="a" fill="#34d399" maxBarSize={16} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "6px" }}>
              {[{ c: "#4d9cf5", l: "Open" }, { c: "#34d399", l: "Resolved" }].map(({ c, l }) => (
                <span key={l} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "9px", color: "var(--ink-2,#5a7490)" }}>
                  <span style={{ width: 8, height: 8, background: c, display: "inline-block", borderRadius: 2 }} />{l}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {prioData.length > 0 && <Divider />}

      {/* ── Priority distribution (full width) ──────────────────── */}
      {prioData.length > 0 && (
        <div>
          <SLabel t="PRIORITY DISTRIBUTION" />
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {prioData.map(d => {
              const pct = Math.round((d.count / Math.max(total, 1)) * 100);
              return (
                <div key={d.label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: d.color, width: "60px", flexShrink: 0 }}>{d.label}</span>
                  <div style={{ flex: 1, height: "9px", borderRadius: "5px", background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: d.color, borderRadius: "5px", transition: "width 0.6s ease" }} />
                  </div>
                  <span style={{ fontSize: "10px", color: d.color, fontWeight: 700, minWidth: "48px", textAlign: "right" }}>
                    {d.count} <span style={{ fontWeight: 400, color: "var(--ink-2,#5a7490)" }}>({pct}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(topRaisedData.length > 0 || reporterData.length > 0) && <Divider />}

      {/* ── Most raised + Reporter activity ─────────────────────── */}
      <div style={G2}>
        {topRaisedData.length > 0 && (
          <div>
            <SLabel t="MOST RAISED ISSUES" />
            <ResponsiveContainer width="100%" height={Math.max(120, topRaisedData.length * 26)}>
              <BarChart data={topRaisedData} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: "var(--ink-2,#5a7490)" }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "var(--ink-1,#9ab0c8)" }} width={120} />
                <Tooltip {...TT} />
                <Bar dataKey="Raises" maxBarSize={16} radius={[0, 4, 4, 0]}>
                  {topRaisedData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ fontSize: "9px", color: "var(--ink-2,#5a7490)", textAlign: "center", marginTop: "4px" }}>recurring pain points by raise count</div>
          </div>
        )}

        {reporterData.length > 0 && (
          <div>
            <SLabel t="ACTIVITY BY REPORTER" />
            <ResponsiveContainer width="100%" height={Math.max(120, reporterData.length * 26)}>
              <BarChart data={reporterData} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: "var(--ink-2,#5a7490)" }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "var(--ink-1,#9ab0c8)" }} width={80} />
                <Tooltip {...TT} />
                <Bar dataKey="Issues" fill="#7c6aff" maxBarSize={16} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ fontSize: "9px", color: "var(--ink-2,#5a7490)", textAlign: "center", marginTop: "4px" }}>issues reported per team member</div>
          </div>
        )}
      </div>

    </div>
  );
}

/* ── Issue card ──────────────────────────────────────────────── */
function IssueCard({
  issue, expanded, onToggle, canRecord, canResolve, canManage, solvingId, setSolvingId, onRefresh, onSetError,
  endorsedSolutions, disregardedSolutions, onEndorse, onDisregard,
}: {
  issue: Issue; expanded: boolean; onToggle: () => void;
  canRecord: boolean; canResolve: boolean; canManage: boolean;
  solvingId: string | null; setSolvingId: (id: string | null) => void;
  onRefresh: () => void; onSetError: (err: string | null) => void;
  endorsedSolutions: Set<string>; disregardedSolutions: Set<string>;
  onEndorse: (issueId: string, solutionId: string) => void;
  onDisregard: (issueId: string, solutionId: string) => void;
}) {
  const p = issue.priority;
  const c = CAT[issue.category] ?? CAT.other;
  const kms = toKmsStatus(issue.kms_status, issue.status);
  const kmsMeta = KMS_STATUS_META[kms];
  const tax = taxonomyLabels(issue.domain, issue.subsystem, issue.leaf_node);
  const activeTool = (issue.deployments ?? []).find(d => d.active) ?? null;

  async function handleRaise() {
    const err = await callApi(`/api/session/issues/${issue.issue_id}/raise`, { method: "POST" });
    if (err) onSetError(err); else onRefresh();
  }

  return (
    <div
      style={{
        borderRadius: "7px",
        border:       "1px solid var(--line,rgba(255,255,255,0.06))",
        background:   "var(--sub,#07101c)",
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
          className="mono"
          style={{
            fontSize: "8px", padding: "2px 6px", borderRadius: "4px", flexShrink: 0, fontWeight: 700,
            background: kmsMeta.bg, color: kmsMeta.color, letterSpacing: "0.04em",
          }}
        >
          {kmsMeta.label}
        </span>
        {issue.reopen_count > 0 && (
          <span className="mono" style={{ fontSize: "9px", color: "#f03a57", flexShrink: 0, fontWeight: 700 }}>
            ↻{issue.reopen_count}
          </span>
        )}
        {issue.raise_count > 0 && (
          <span style={{ fontSize: "10px", color: "#f0a030", flexShrink: 0 }}>↑{issue.raise_count}</span>
        )}
        <span style={{ fontSize: "10px", color: "var(--ink-2,#5a7490)" }}>{expanded ? "▾" : "▸"}</span>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: "0 10px 10px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {/* KMS telemetry — taxonomy path, active tool, OOS survivability */}
          <div style={{
            padding: "7px 10px", borderRadius: 6,
            background: "var(--card,#0b1622)", border: "1px solid var(--line,rgba(255,255,255,0.06))",
            display: "flex", flexDirection: "column", gap: 4,
          }}>
            <div className="mono" style={{ fontSize: 9, color: "var(--ink-1,#9ab0c8)" }}>
              {tax.leaf
                ? <>{tax.domain} <span style={{ color: "var(--ink-2,#5a7490)" }}>→</span> {tax.subsystem} <span style={{ color: "var(--ink-2,#5a7490)" }}>→</span> <span style={{ color: kmsMeta.color, fontWeight: 700 }}>{tax.leaf}</span></>
                : <span style={{ color: "var(--ink-2,#5a7490)" }}>unclassified — legacy record (pre-ontology)</span>}
            </div>
            {activeTool && (
              <div className="mono" style={{ fontSize: 9, color: "#00b4ff" }}>
                tool: {activeTool.tool_name} {activeTool.tool_version}
                {activeTool.relapses > 0 && <span style={{ color: "#f03a57" }}> · failed OOS ×{activeTool.relapses}</span>}
              </div>
            )}
            {kms === "OOS_VALIDATION" && (
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                  <div style={{
                    width: `${Math.min(100, ((issue.oos_sessions ?? 0) / Math.max(1, issue.oos_sessions_required ?? 15)) * 100)}%`,
                    height: "100%", background: "#00b4ff", borderRadius: 2,
                  }} />
                </div>
                <span className="mono" style={{ fontSize: 8.5, color: "#00b4ff", flexShrink: 0 }}>
                  {issue.oos_sessions ?? 0}/{issue.oos_sessions_required ?? 15} sessions
                </span>
              </div>
            )}
          </div>
          <RecordSection
            issue={issue}
            canRecord={canRecord}
            onRaise={handleRaise}
            onRefresh={onRefresh}
          />
          <ResolveSection
            issue={issue}
            canResolve={canResolve}
            canManage={canManage}
            canRecord={canRecord}
            solvingId={solvingId}
            setSolvingId={setSolvingId}
            onRefresh={onRefresh}
            onSetError={onSetError}
            endorsedSolutions={endorsedSolutions}
            disregardedSolutions={disregardedSolutions}
            onEndorse={onEndorse}
            onDisregard={onDisregard}
          />
        </div>
      )}
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
  const [endorsedSolutions,    setEndorsedSolutions]    = useState<Set<string>>(new Set());
  const [disregardedSolutions, setDisregardedSolutions] = useState<Set<string>>(new Set());

  const roles: string[] = (session as any)?.roles ?? [];
  const canRecord  = roles.some(r => ["operator", "analyst", "strategist", "fund_manager"].includes(r));
  const canResolve = roles.some(r => ["strategist", "fund_manager"].includes(r));
  const canManage  = canResolve && showInsight;
  const roleLabel  = canResolve ? "RESOLVER" : canRecord ? "RECORDER" : "VIEWER";
  const roleColor  = canResolve ? "#00cc7a"  : canRecord ? "#4d9cf5"  : "var(--ink-2,#5a7490)";

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

  async function handleEndorse(issueId: string, solutionId: string) {
    setEndorsedSolutions(prev => new Set([...prev, solutionId]));
    const err = await callApi(`/api/session/issues/${issueId}/solution/endorse`, { method: "POST" });
    if (err) {
      setApiError(err);
      setEndorsedSolutions(prev => { const s = new Set(prev); s.delete(solutionId); return s; });
    } else { loadIssues(); }
  }

  async function handleDisregard(issueId: string, solutionId: string) {
    setDisregardedSolutions(prev => new Set([...prev, solutionId]));
    const err = await callApi(`/api/session/issues/${issueId}/solution/disregard`, { method: "POST" });
    if (err) {
      setApiError(err);
      setDisregardedSolutions(prev => { const s = new Set(prev); s.delete(solutionId); return s; });
    } else { loadIssues(); }
  }

  useEffect(() => {
    if (open) loadIssues();
  }, [open, loadIssues]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (tab === "insight") setTab("open");
      else setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, tab]);

  const filtered = useMemo(() => {
    const k = (i: Issue) => toKmsStatus(i.kms_status, i.status);
    if (tab === "open")     return issues.filter(i => ["TRIAGE_PENDING", "RELAPSED", "TOOL_QUEUED"].includes(k(i)));
    if (tab === "staging")  return issues.filter(i => k(i) === "OOS_VALIDATION");
    if (tab === "archived") return issues.filter(i => k(i) === "BASELINE_RESTORED");
    return issues;
  }, [issues, tab]);

  const openCnt    = issues.filter(i => ["TRIAGE_PENDING", "RELAPSED", "TOOL_QUEUED"].includes(toKmsStatus(i.kms_status, i.status))).length;
  const stagingCnt = issues.filter(i => toKmsStatus(i.kms_status, i.status) === "OOS_VALIDATION").length;

  function TabBtn({ k, label, badge }: { k: TabFilter; label: string; badge?: number }) {
    const active = tab === k;
    return (
      <button
        onClick={() => setTab(k)}
        style={{
          padding:       "5px 11px",
          borderRadius:  "5px",
          background:    active ? "var(--raised,#0f1e2e)" : "none",
          border:        active ? "1px solid var(--line,rgba(255,255,255,0.06))" : "1px solid transparent",
          color:         active ? "var(--ink-0,#eef2f8)" : "var(--ink-2,#5a7490)",
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
              background:   k === "open" ? "var(--red,#f03a57)" : "var(--amber,#f0a030)",
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
          bottom:         isMobile ? 20 : 28,
          right:          isMobile ? "50%" : 28,
          transform:      isMobile ? "translateX(50%)" : "none",
          zIndex:         900,
          width:          50,
          height:         50,
          borderRadius:   "50%",
          background:     canResolve
            ? "linear-gradient(135deg,#00cc7a,#00a060)"
            : canRecord
            ? "linear-gradient(135deg,#4d9cf5,#2a72c8)"
            : "linear-gradient(135deg,#1e3050,#0f1e30)",
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

      {/* Insight overlay panel — wide panel to the left of the issues panel (desktop only) */}
      {open && tab === "insight" && showInsight && canResolve && !isMobile && (
        <>
          {/* Backdrop — blurred, click outside to close */}
          <div
            onClick={() => setTab("open")}
            style={{
              position:              "fixed",
              inset:                 0,
              zIndex:                897,
              background:            "rgba(0,0,0,0.45)",
              backdropFilter:        "blur(6px)",
              WebkitBackdropFilter:  "blur(6px)",
            }}
          />

          {/* Insight panel — floating with 7.1% margin */}
          <div
            style={{
              position:      "fixed",
              top:           "7.1vh",
              bottom:        "7.1vh",
              left:          "calc((100vw - min(480px,100vw)) * 0.071)",
              right:         "calc(min(480px,100vw) + (100vw - min(480px,100vw)) * 0.071)",
              zIndex:        898,
              background:    "var(--card,#0b1622)",
              border:        "1px solid var(--line,rgba(255,255,255,0.06))",
              borderRadius:  "10px",
              boxShadow:     "0 8px 64px rgba(0,0,0,0.75)",
              display:       "flex",
              flexDirection: "column",
              overflow:      "hidden",
            }}
          >
            {/* Insight header */}
            <div
              style={{
                padding:      "14px 18px",
                borderBottom: "1px solid var(--line,rgba(255,255,255,0.06))",
                flexShrink:   0,
                display:      "flex",
                alignItems:   "center",
                gap:          "10px",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink-1,#9ab0c8)" }}>Issue Analytics</span>
              <span
                style={{
                  padding:       "2px 8px",
                  borderRadius:  "4px",
                  fontSize:      "9px",
                  fontWeight:    700,
                  background:    "rgba(124,106,255,0.12)",
                  color:         "#7c6aff",
                  letterSpacing: "0.4px",
                }}
              >
                {issues.length} ISSUES
              </span>
              <button
                onClick={() => setTab("open")}
                style={{
                  marginLeft:   "auto",
                  background:   "none",
                  border:       "none",
                  color:        "var(--ink-2,#5a7490)",
                  fontSize:     "18px",
                  lineHeight:   1,
                  cursor:       "pointer",
                  padding:      "0 2px",
                }}
                aria-label="Close analytics"
              >
                ×
              </button>
            </div>
            <div className="iss-scroll" style={{ flex: 1, overflowY: "auto" }}>
              <InsightTab issues={issues} />
            </div>
          </div>
        </>
      )}

      {/* Side panel */}
      {open && (
        <>
          {/* Mobile backdrop */}
          {isMobile && (
            <div
              onClick={() => setOpen(false)}
              style={{
                position: "fixed", inset: 0,
                zIndex: 898,
                background: "rgba(0,0,0,0.55)",
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
              }}
            />
          )}
        <div
          style={isMobile ? {
            position:      "fixed",
            left:          0,
            right:         0,
            bottom:        0,
            height:        "88vh",
            zIndex:        899,
            background:    "var(--card,#0b1622)",
            borderTop:     "1px solid var(--line-hi,rgba(255,255,255,0.11))",
            borderRadius:  "16px 16px 0 0",
            boxShadow:     "0 -8px 48px rgba(0,0,0,0.72)",
            display:       "flex",
            flexDirection: "column",
          } : {
            position:      "fixed",
            top:           0,
            right:         0,
            bottom:        0,
            zIndex:        899,
            width:         "min(480px,100vw)",
            background:    "var(--card,#0b1622)",
            borderLeft:    "1px solid var(--line,rgba(255,255,255,0.06))",
            boxShadow:     "-4px 0 56px rgba(0,0,0,0.72)",
            display:       "flex",
            flexDirection: "column",
          }}
        >
          {/* Mobile drag handle */}
          {isMobile && (
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--line-hi,rgba(255,255,255,0.11))" }} />
            </div>
          )}

          {/* Panel header */}
          <div
            style={{
              padding:      isMobile ? "8px 15px 0" : "15px 15px 0",
              borderBottom: "1px solid var(--line,rgba(255,255,255,0.06))",
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
                    border:       "1px solid var(--line-hi,rgba(255,255,255,0.11))",
                    background:   "none",
                    color:        "var(--ink-2,#5a7490)",
                    fontSize:     "11px",
                    cursor:       "pointer",
                  }}
                >
                  {loading ? "…" : "↻"}
                </button>
              </div>
            </div>

            {/* Tabs — survivability pipeline groupings */}
            <div style={{ display: "flex", gap: "2px", paddingBottom: "8px", overflowX: "auto" }}>
              <TabBtn k="open" label="Triage" badge={openCnt} />
              {(showInsight || canResolve) && (
                <TabBtn k="staging" label="OOS" badge={stagingCnt} />
              )}
              {(showInsight || canResolve) && (
                <TabBtn k="archived" label="Baseline" />
              )}
              {canResolve && (
                <TabBtn k="tools" label="Tools" />
              )}
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
            {tab !== "insight" && tab !== "tools" && !creating && (
              <KmsDashboard issues={issues} />
            )}

            {creating && (
              <TriageReportForm
                issues={issues}
                onDone={() => { setCreating(false); loadIssues(); }}
                onCancel={() => setCreating(false)}
              />
            )}

            {tab === "tools" && canResolve ? (
              <ToolRegistry issues={issues} canManage={canResolve} onRefresh={loadIssues} />
            ) : tab === "insight" && showInsight && canResolve ? (
              isMobile
                ? <InsightTab issues={issues} />
                : <div style={{ textAlign: "center", padding: "52px 20px", color: "var(--ink-2,#5a7490)", fontSize: "12px", lineHeight: 1.7 }}>
                    <div style={{ fontSize: "22px", marginBottom: "8px" }}>↔</div>
                    Analytics panel open to the left
                  </div>
            ) : loading ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "var(--ink-2,#5a7490)", fontSize: "13px" }}>
                Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "var(--ink-2,#5a7490)", fontSize: "13px" }}>
                {tab === "open"     ? "Triage queue clear — no active anomalies"
                : tab === "staging" ? "No issues in OOS validation"
                :                    "No baseline-restored issues"}
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
                    canManage={canManage}
                    solvingId={solvingId}
                    setSolvingId={setSolvingId}
                    onRefresh={loadIssues}
                    onSetError={setApiError}
                    endorsedSolutions={endorsedSolutions}
                    disregardedSolutions={disregardedSolutions}
                    onEndorse={handleEndorse}
                    onDisregard={handleDisregard}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        </>
      )}
    </>
  );
}
