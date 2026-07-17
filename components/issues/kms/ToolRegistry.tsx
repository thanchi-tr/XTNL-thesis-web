"use client";

/**
 * ToolRegistry — the Digital Tool catalog (independent asset ledger).
 *
 * Strategist-only operations:
 *   • Register a new tool (name / category / blueprint / version).
 *   • Deploy a tool against a pending anomaly (TOOL_QUEUED) or deploy+activate
 *     straight into OOS_VALIDATION.
 *   • Activate queued deployments (TOOL_QUEUED → OOS_VALIDATION).
 * Every tool shows its aggregated efficacy telemetry: deployments, relapsed
 * deployments, and the global effectiveness score in monospace.
 */

import { useCallback, useEffect, useState } from "react";
import { toKmsStatus } from "@/lib/kms";

interface Tool {
  tool_id: string;
  name: string;
  category: string;
  blueprint: string;
  version: string;
  created_by: string;
  deprecated: boolean;
  deployments: number;
  active_deployments: number;
  relapsed_deployments: number;
  effectiveness: number | null;
}

interface RegistryIssue {
  issue_id: string;
  title: string;
  status: string;
  kms_status?: string | null;
}

const TOOL_CATS = ["friction", "firmware", "protocol", "hardware", "biometric"] as const;

const INPUT: React.CSSProperties = {
  width: "100%", padding: "6px 9px", borderRadius: 6,
  border: "1px solid var(--line-hi,rgba(255,255,255,0.11))",
  background: "var(--base,#04080f)", color: "var(--ink-0,#eef2f8)",
  fontSize: 12, outline: "none",
};
const OPT: React.CSSProperties = { background: "var(--card,#0b1622)", color: "var(--ink-1,#9ab0c8)" };

export default function ToolRegistry({
  issues, canManage, onRefresh,
}: {
  issues: RegistryIssue[];
  canManage: boolean;
  onRefresh: () => void;
}) {
  const [tools,    setTools]    = useState<Tool[]>([]);
  const [migrated, setMigrated] = useState(true);
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState<string | null>(null);
  const [showReg,  setShowReg]  = useState(false);
  const [reg,      setReg]      = useState({ name: "", category: "friction", blueprint: "", version: "v1.0" });
  const [deployFor, setDeployFor] = useState<Record<string, string>>({});   // tool_id → issue_id
  const [busy,     setBusy]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/session/tools");
      const j = await r.json();
      if (!r.ok) { setErr(j?.error ?? "Failed to load registry"); return; }
      setTools(j.tools ?? []);
      setMigrated(j.migrated !== false);
    } catch { setErr("Network error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const targets = issues.filter(i =>
    ["TRIAGE_PENDING", "RELAPSED"].includes(toKmsStatus(i.kms_status, i.status)));
  const queued  = issues.filter(i => toKmsStatus(i.kms_status, i.status) === "TOOL_QUEUED");

  async function registerTool() {
    if (!reg.name.trim() || !reg.blueprint.trim()) { setErr("Name and blueprint are required"); return; }
    setBusy("register"); setErr(null);
    try {
      const r = await fetch("/api/session/tools", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reg),
      });
      if (!r.ok) { setErr((await r.json().catch(() => ({})))?.error ?? "Registration failed"); return; }
      setReg({ name: "", category: "friction", blueprint: "", version: "v1.0" });
      setShowReg(false);
      load();
    } catch { setErr("Network error"); }
    finally { setBusy(null); }
  }

  async function deploy(toolId: string, activate: boolean) {
    const issueId = deployFor[toolId];
    if (!issueId) { setErr("Select a target anomaly first"); return; }
    setBusy(toolId); setErr(null);
    try {
      const r = await fetch(`/api/session/issues/${issueId}/deploy`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool_id: toolId, activate }),
      });
      if (!r.ok) { setErr((await r.json().catch(() => ({})))?.error ?? "Deployment failed"); return; }
      setDeployFor(p => ({ ...p, [toolId]: "" }));
      load(); onRefresh();
    } catch { setErr("Network error"); }
    finally { setBusy(null); }
  }

  async function activateQueued(issueId: string) {
    setBusy(issueId); setErr(null);
    try {
      const r = await fetch(`/api/session/issues/${issueId}/deploy`, { method: "PATCH" });
      if (!r.ok) { setErr((await r.json().catch(() => ({})))?.error ?? "Activation failed"); return; }
      load(); onRefresh();
    } catch { setErr("Network error"); }
    finally { setBusy(null); }
  }

  return (
    <div style={{ padding: "12px 11px", display: "flex", flexDirection: "column", gap: 10 }}>
      {!migrated && (
        <div style={{ fontSize: 11.5, color: "#f0a030", padding: "8px 11px", borderRadius: 8, background: "rgba(240,160,48,0.08)", border: "1px solid rgba(240,160,48,0.3)", lineHeight: 1.6 }}>
          Digital Tool tables not found — run <span className="mono" style={{ fontSize: 10.5 }}>supabase/kms_migration.sql</span> to enable the registry.
        </div>
      )}

      {err && (
        <div style={{ fontSize: 11.5, color: "#f03a57", padding: "6px 10px", borderRadius: 6, background: "rgba(240,58,87,0.08)", display: "flex", justifyContent: "space-between" }}>
          {err}
          <button onClick={() => setErr(null)} style={{ background: "none", border: "none", color: "#f03a57", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* Queued deployments awaiting activation */}
      {canManage && queued.length > 0 && (
        <div style={{ padding: "9px 11px", borderRadius: 8, border: "1px solid rgba(77,156,245,0.3)", background: "rgba(77,156,245,0.06)" }}>
          <div className="mono" style={{ fontSize: 8.5, letterSpacing: "0.1em", color: "#6fb2ff", fontWeight: 700, marginBottom: 6 }}>
            TOOL_QUEUED — AWAITING LIVE DEPLOYMENT
          </div>
          {queued.map(q => (
            <div key={q.issue_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
              <span style={{ flex: 1, fontSize: 11.5, color: "var(--ink-1,#9ab0c8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.title}</span>
              <button
                onClick={() => activateQueued(q.issue_id)}
                disabled={busy === q.issue_id}
                style={{ padding: "3px 9px", borderRadius: 5, border: "1px solid rgba(0,180,255,0.4)", background: "rgba(0,180,255,0.1)", color: "#00b4ff", fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
              >
                {busy === q.issue_id ? "…" : "Activate OOS →"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Register */}
      {canManage && migrated && (
        showReg ? (
          <div style={{ padding: "11px 12px", borderRadius: 8, border: "1px solid rgba(0,204,122,0.25)", background: "var(--sub,#07101c)", display: "flex", flexDirection: "column", gap: 7 }}>
            <span className="mono" style={{ fontSize: 8.5, letterSpacing: "0.1em", color: "#00cc7a", fontWeight: 700 }}>REGISTER DIGITAL TOOL</span>
            <input style={INPUT} placeholder="Tool name…" value={reg.name} maxLength={120}
              onChange={e => setReg(p => ({ ...p, name: e.target.value }))} />
            <div style={{ display: "flex", gap: 7 }}>
              <select style={{ ...INPUT, flex: 1, cursor: "pointer" }} value={reg.category}
                onChange={e => setReg(p => ({ ...p, category: e.target.value }))}>
                {TOOL_CATS.map(c => <option key={c} value={c} style={OPT}>{c}</option>)}
              </select>
              <input style={{ ...INPUT, width: 84 }} value={reg.version} maxLength={20}
                onChange={e => setReg(p => ({ ...p, version: e.target.value }))} />
            </div>
            <textarea style={{ ...INPUT, minHeight: 56, resize: "vertical" }} maxLength={3000}
              placeholder="Implementation blueprint…" value={reg.blueprint}
              onChange={e => setReg(p => ({ ...p, blueprint: e.target.value }))} />
            <div style={{ display: "flex", gap: 7 }}>
              <button onClick={registerTool} disabled={busy === "register"}
                style={{ padding: "6px 13px", borderRadius: 6, border: "1px solid rgba(0,204,122,0.45)", background: "rgba(0,204,122,0.14)", color: "#00e688", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                {busy === "register" ? "…" : "Register asset"}
              </button>
              <button onClick={() => setShowReg(false)}
                style={{ padding: "6px 11px", borderRadius: 6, border: "1px solid var(--line-hi,rgba(255,255,255,0.11))", background: "none", color: "var(--ink-2,#5a7490)", fontSize: 11, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowReg(true)}
            style={{ alignSelf: "flex-start", padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(0,204,122,0.3)", background: "rgba(0,204,122,0.09)", color: "#00cc7a", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            + Register tool
          </button>
        )
      )}

      {/* Catalog */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: "var(--ink-2,#5a7490)", fontSize: 12.5 }}>Loading registry…</div>
      ) : tools.length === 0 && migrated ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: "var(--ink-2,#5a7490)", fontSize: 12.5 }}>No digital tools registered</div>
      ) : (
        tools.map(t => {
          const eff = t.effectiveness;
          const effCol = eff === null ? "var(--ink-2,#5a7490)" : eff >= 80 ? "#00cc7a" : eff >= 50 ? "#f0a030" : "#f03a57";
          return (
            <div key={t.tool_id} style={{
              padding: "10px 12px", borderRadius: 8,
              border: "1px solid var(--line,rgba(255,255,255,0.06))", background: "var(--sub,#07101c)",
              opacity: t.deprecated ? 0.55 : 1,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-0,#eef2f8)" }}>{t.name}</span>
                <span className="mono" style={{ fontSize: 9, color: "var(--ink-2,#5a7490)" }}>{t.version}</span>
                <span className="mono" style={{ fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(77,156,245,0.1)", color: "#6fb2ff", textTransform: "uppercase" }}>
                  {t.category}
                </span>
                {t.deprecated && (
                  <span className="mono" style={{ fontSize: 8, fontWeight: 700, color: "#f03a57" }}>DEPRECATED</span>
                )}
                <span className="mono" style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: effCol }}>
                  {eff === null ? "—" : `${eff.toFixed(1)}%`}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-1,#9ab0c8)", lineHeight: 1.6, margin: "5px 0 6px" }}>
                {t.blueprint.length > 220 ? t.blueprint.slice(0, 220) + "…" : t.blueprint}
              </div>
              <div className="mono" style={{ fontSize: 9, color: "var(--ink-2,#5a7490)" }}>
                {t.deployments} deployment{t.deployments === 1 ? "" : "s"} · {t.active_deployments} active · {t.relapsed_deployments} relapsed
              </div>

              {canManage && !t.deprecated && targets.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <select
                    style={{ ...INPUT, width: "auto", flex: 1, minWidth: 140, cursor: "pointer", fontSize: 11 }}
                    value={deployFor[t.tool_id] ?? ""}
                    onChange={e => setDeployFor(p => ({ ...p, [t.tool_id]: e.target.value }))}
                  >
                    <option value="" style={OPT}>Deploy against…</option>
                    {targets.map(i => (
                      <option key={i.issue_id} value={i.issue_id} style={OPT}>{i.title.slice(0, 60)}</option>
                    ))}
                  </select>
                  <button onClick={() => deploy(t.tool_id, false)} disabled={busy === t.tool_id}
                    style={{ padding: "5px 10px", borderRadius: 5, border: "1px solid rgba(77,156,245,0.4)", background: "rgba(77,156,245,0.1)", color: "#6fb2ff", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                    Queue
                  </button>
                  <button onClick={() => deploy(t.tool_id, true)} disabled={busy === t.tool_id}
                    style={{ padding: "5px 10px", borderRadius: 5, border: "1px solid rgba(0,180,255,0.4)", background: "rgba(0,180,255,0.1)", color: "#00b4ff", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                    Deploy + OOS
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
