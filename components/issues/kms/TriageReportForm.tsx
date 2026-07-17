"use client";

/**
 * TriageReportForm — the Zero-Knowledge Auto-Triage Intercept.
 *
 * The operator NEVER submits directly. The flow is:
 *   1. Taxonomy lockout — Domain → Sub-System → Leaf Node cascade (no free text).
 *   2. Symptom telemetry — title + description.
 *   3. "Analyze Symptoms" — the ONLY trigger. The draft is scored against the
 *      already-loaded ledger in-memory (sub-100 ms, no network, no spinner).
 *   4. The epistemological fork:
 *        State A — historical match: submission halts; matches + their deployed
 *          tools render; the operator either confirms a RELAPSE (no new row) or
 *          rejects all matches.
 *        State B — novel anomaly: only now does "Commit Novel Issue" render.
 * Any edit to the draft resets the fork — analysis is mandatory per revision.
 */

import { useMemo, useState } from "react";
import {
  TAXONOMY, triageScore, similarityPct, TRIAGE_MATCH_THRESHOLD,
  KMS_STATUS_META, toKmsStatus, taxonomyLabels, type KmsStatus,
} from "@/lib/kms";

export interface TriageLedgerIssue {
  issue_id: string;
  title: string;
  description: string | null;
  domain?: string | null;
  subsystem?: string | null;
  leaf_node?: string | null;
  status: string;
  kms_status?: string | null;
  reopen_count: number;
  deployments?: { tool_name: string; tool_version: string; active: boolean }[];
}

const INPUT: React.CSSProperties = {
  width: "100%", padding: "7px 10px", borderRadius: 6,
  border: "1px solid var(--line-hi,rgba(255,255,255,0.11))",
  background: "var(--base,#04080f)", color: "var(--ink-0,#eef2f8)",
  fontSize: 12.5, outline: "none",
};
const SEL: React.CSSProperties = { ...INPUT, cursor: "pointer", appearance: "none" as const };
const LABEL: React.CSSProperties = {
  fontSize: 8.5, letterSpacing: "0.12em", color: "var(--ink-2,#5a7490)",
  fontFamily: "var(--font-mono)", fontWeight: 700, display: "block", marginBottom: 4,
};
const OPT: React.CSSProperties = { background: "var(--card,#0b1622)", color: "var(--ink-1,#9ab0c8)" };

type Fork = "idle" | "match" | "novel";

export default function TriageReportForm({
  issues, onDone, onCancel,
}: {
  issues: TriageLedgerIssue[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [domain,    setDomain]    = useState("");
  const [subsystem, setSubsystem] = useState("");
  const [leaf,      setLeaf]      = useState("");
  const [title,     setTitle]     = useState("");
  const [desc,      setDesc]      = useState("");
  const [fork,      setFork]      = useState<Fork>("idle");
  const [scanMs,    setScanMs]    = useState<number | null>(null);
  const [matches,   setMatches]   = useState<{ issue: TriageLedgerIssue; pct: number }[]>([]);
  const [busy,      setBusy]      = useState(false);
  const [err,       setErr]       = useState<string | null>(null);

  const domainNode = useMemo(() => TAXONOMY.find(d => d.id === domain), [domain]);
  const subNode    = useMemo(() => domainNode?.subs.find(s => s.id === subsystem), [domainNode, subsystem]);
  const leafValid  = !!subNode?.leaves.find(l => l.id === leaf);
  const draftReady = leafValid && title.trim().length >= 4;

  function resetFork() { setFork("idle"); setMatches([]); setScanMs(null); setErr(null); }

  /* Step 2 — the semantic intercept. Pure in-memory scan: deterministic <100ms. */
  function analyze() {
    const t0 = performance.now();
    const ledger = issues.map(i => ({
      issue_id: i.issue_id, title: i.title, description: i.description,
      domain: i.domain ?? null, subsystem: i.subsystem ?? null, leaf_node: i.leaf_node ?? null,
    }));
    const ranked = triageScore(
      { title: title.trim(), description: desc.trim(), domain, subsystem, leaf },
      ledger,
    ).filter(m => m.score >= TRIAGE_MATCH_THRESHOLD).slice(0, 3);
    const t1 = performance.now();
    setScanMs(Math.max(1, Math.round(t1 - t0)));

    if (ranked.length > 0) {
      const byId = new Map(issues.map(i => [i.issue_id, i]));
      setMatches(ranked.map(m => ({ issue: byId.get(m.issue_id)!, pct: similarityPct(m.score) })));
      setFork("match");
    } else {
      setMatches([]);
      setFork("novel");
    }
  }

  /* State A confirmation — relapse of a known vulnerability. No new row. */
  async function confirmRelapse(issueId: string) {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/session/issues/${issueId}/reopen`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: `Triage intercept relapse — operator symptoms matched. Draft: "${title.trim().slice(0, 140)}"` }),
      });
      if (!r.ok) { setErr((await r.json().catch(() => ({})))?.error ?? "Relapse update failed"); return; }
      onDone();
    } catch { setErr("Network error"); }
    finally { setBusy(false); }
  }

  /* State B — ingestion authorised: the profile is mathematically unique. */
  async function commitNovel() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/session/issues", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(), description: desc.trim() || null,
          domain, subsystem, leaf_node: leaf,
        }),
      });
      if (!r.ok) { setErr((await r.json().catch(() => ({})))?.error ?? "Commit failed"); return; }
      onDone();
    } catch { setErr("Network error"); }
    finally { setBusy(false); }
  }

  return (
    <div style={{
      margin: "12px 11px 4px", padding: "13px 13px 14px", borderRadius: 10,
      border: "1px solid rgba(0,204,122,0.22)", background: "var(--sub,#07101c)",
      display: "flex", flexDirection: "column", gap: 11,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-0,#eef2f8)" }}>Symptom Report</span>
        <span className="mono" style={{ fontSize: 8, letterSpacing: "0.1em", color: "var(--ink-2,#5a7490)" }}>
          ZERO-KNOWLEDGE TRIAGE
        </span>
        <button onClick={onCancel} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--ink-2,#5a7490)", fontSize: 15, cursor: "pointer", lineHeight: 1 }}>×</button>
      </div>

      {/* ── Tier 1–3: the ontological cascade (lockout — no free text) ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <span style={LABEL}>TIER 1 · SOVEREIGN DOMAIN</span>
          <select style={SEL} value={domain}
            onChange={e => { setDomain(e.target.value); setSubsystem(""); setLeaf(""); resetFork(); }}>
            <option value="" style={OPT}>Select domain…</option>
            {TAXONOMY.map(d => (
              <option key={d.id} value={d.id} style={OPT}>{d.label} — {d.hint}</option>
            ))}
          </select>
        </div>
        <div>
          <span style={LABEL}>TIER 2 · SUB-SYSTEM CONTEXT</span>
          <select style={{ ...SEL, opacity: domainNode ? 1 : 0.4 }} value={subsystem} disabled={!domainNode}
            onChange={e => { setSubsystem(e.target.value); setLeaf(""); resetFork(); }}>
            <option value="" style={OPT}>Select sub-system…</option>
            {domainNode?.subs.map(s => (
              <option key={s.id} value={s.id} style={OPT}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <span style={LABEL}>TIER 3 · VERIFIED LEAF NODE</span>
          <select style={{ ...SEL, opacity: subNode ? 1 : 0.4 }} value={leaf} disabled={!subNode}
            onChange={e => { setLeaf(e.target.value); resetFork(); }}>
            <option value="" style={OPT}>Select leaf node…</option>
            {subNode?.leaves.map(l => (
              <option key={l.id} value={l.id} style={OPT}>{l.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Symptom telemetry ── */}
      <div>
        <span style={LABEL}>SYMPTOM TITLE</span>
        <input style={INPUT} value={title} maxLength={200} placeholder="Concise physical symptom…"
          onChange={e => { setTitle(e.target.value); resetFork(); }} />
      </div>
      <div>
        <span style={LABEL}>SYMPTOM DETAIL · LATENCY VALUES · CONDITIONS</span>
        <textarea style={{ ...INPUT, minHeight: 64, resize: "vertical" }} value={desc} maxLength={2000}
          placeholder="Observable conditions only — the system determines the classification…"
          onChange={e => { setDesc(e.target.value); resetFork(); }} />
      </div>

      {err && (
        <div style={{ fontSize: 11.5, color: "#f03a57", padding: "6px 10px", borderRadius: 6, background: "rgba(240,58,87,0.08)" }}>
          {err}
        </div>
      )}

      {/* ── The intercept trigger — there is no submit at this stage ── */}
      {fork === "idle" && (
        <button
          onClick={analyze}
          disabled={!draftReady}
          style={{
            padding: "9px 14px", borderRadius: 8, cursor: draftReady ? "pointer" : "not-allowed",
            border: "1px solid rgba(77,156,245,0.4)",
            background: draftReady ? "rgba(77,156,245,0.14)" : "rgba(77,156,245,0.05)",
            color: draftReady ? "#6fb2ff" : "var(--ink-2,#5a7490)",
            fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
          }}
        >
          ⌕ Analyze Symptoms
        </button>
      )}

      {/* ── State A — precedent found: submission physically halted ── */}
      {fork === "match" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{
            padding: "9px 11px", borderRadius: 8,
            background: "rgba(240,160,48,0.08)", border: "1px solid rgba(240,160,48,0.3)",
          }}>
            <div className="mono" style={{ fontSize: 9, letterSpacing: "0.1em", color: "#f0a030", fontWeight: 700, marginBottom: 4 }}>
              ⚠ HISTORICAL MATCH — SUBMISSION HALTED
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-1,#9ab0c8)", lineHeight: 1.6 }}>
              The search matrix mapped your inputs to {matches.length} historical record{matches.length > 1 ? "s" : ""}{" "}
              <span className="mono" style={{ fontSize: 10, color: "var(--ink-2,#5a7490)" }}>({scanMs}ms scan)</span>.
              Is this a relapse of a known vulnerability?
            </div>
          </div>

          {matches.map(({ issue: m, pct }) => {
            const k = toKmsStatus(m.kms_status, m.status) as KmsStatus;
            const meta = KMS_STATUS_META[k];
            const tax = taxonomyLabels(m.domain, m.subsystem, m.leaf_node);
            const tools = (m.deployments ?? []).filter(d => d.active);
            return (
              <div key={m.issue_id} style={{
                padding: "9px 11px", borderRadius: 8,
                border: "1px solid var(--line-hi,rgba(255,255,255,0.11))", background: "var(--card,#0b1622)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: "#6fb2ff" }}>{pct.toFixed(1)}%</span>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--ink-0,#eef2f8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.title}
                  </span>
                  <span className="mono" style={{ fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: meta.bg, color: meta.color, flexShrink: 0 }}>
                    {meta.label}
                  </span>
                </div>
                <div className="mono" style={{ fontSize: 9, color: "var(--ink-2,#5a7490)", marginBottom: tools.length > 0 ? 5 : 7 }}>
                  {tax.leaf ? `${tax.domain} → ${tax.subsystem} → ${tax.leaf}` : "unclassified (legacy)"}
                  {m.reopen_count > 0 && <span style={{ color: "#f03a57" }}>  ·  relapses ×{m.reopen_count}</span>}
                </div>
                {tools.length > 0 && (
                  <div className="mono" style={{ fontSize: 9.5, color: "#00b4ff", marginBottom: 7 }}>
                    deployed: {tools.map(t => `${t.tool_name} ${t.tool_version}`).join(" · ")}
                  </div>
                )}
                <button
                  onClick={() => confirmRelapse(m.issue_id)}
                  disabled={busy}
                  style={{
                    padding: "6px 12px", borderRadius: 6, cursor: "pointer",
                    border: "1px solid rgba(240,58,87,0.4)", background: "rgba(240,58,87,0.12)",
                    color: "#f03a57", fontSize: 11, fontWeight: 700,
                  }}
                >
                  {busy ? "…" : "Confirm relapse — no new issue"}
                </button>
              </div>
            );
          })}

          <button
            onClick={() => setFork("novel")}
            disabled={busy}
            style={{
              padding: "7px 12px", borderRadius: 6, cursor: "pointer",
              border: "1px solid var(--line-hi,rgba(255,255,255,0.11))", background: "none",
              color: "var(--ink-1,#9ab0c8)", fontSize: 11,
            }}
          >
            None of these — symptoms are distinct
          </button>
        </div>
      )}

      {/* ── State B — novel anomaly: ingestion authorised ── */}
      {fork === "novel" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{
            padding: "9px 11px", borderRadius: 8,
            background: "rgba(0,204,122,0.07)", border: "1px solid rgba(0,204,122,0.28)",
          }}>
            <div className="mono" style={{ fontSize: 9, letterSpacing: "0.1em", color: "#00cc7a", fontWeight: 700, marginBottom: 3 }}>
              ✓ NOVEL ANOMALY — INGESTION AUTHORISED
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-1,#9ab0c8)", lineHeight: 1.6 }}>
              Symptom profile is mathematically unique against the ledger
              {scanMs !== null && <span className="mono" style={{ fontSize: 10, color: "var(--ink-2,#5a7490)" }}> ({scanMs}ms scan)</span>}.
            </div>
          </div>
          <button
            onClick={commitNovel}
            disabled={busy}
            style={{
              padding: "9px 14px", borderRadius: 8, cursor: "pointer",
              border: "1px solid rgba(0,204,122,0.45)", background: "rgba(0,204,122,0.15)",
              color: "#00e688", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
            }}
          >
            {busy ? "Committing…" : "Commit Novel Issue"}
          </button>
        </div>
      )}
    </div>
  );
}
