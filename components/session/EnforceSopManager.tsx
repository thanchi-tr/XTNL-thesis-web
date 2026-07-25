"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { SopRow } from "@/lib/sopTypes";
import { EntryChecklistToggle, AttentionChallengeToggle } from "@/components/session/AnalystToggles";

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden style={{ animation: "spin-esm 0.7s linear infinite", flexShrink: 0 }}>
      <style>{`@keyframes spin-esm { to { transform: rotate(360deg); } }`}</style>
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5"/>
      <path d="M7 1.5a5.5 5.5 0 0 1 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

type SubView = "active" | "archived";

/**
 * Strategist's SOP-enforcement + session-governance workflow (Analytics
 * page → Enforce SOP tab). Self-contained: fetches the full SOP library
 * plus whatever's currently enforced, lets the strategist archive/
 * reactivate checklists and tick which active ones should be enforced,
 * then batch-submits (or reverts) the selection — takes effect
 * immediately for operators (see /api/session/sops/enforcements, which
 * reads the most recent submission regardless of which calendar week it
 * was filed under). Also hosts the two operator session-governance
 * toggles (entry checklist, attention challenge) — moved here from the
 * session page's analyst view so every "enforce X on the operator"
 * control lives in one place.
 */
export default function EnforceSopManager() {
  const [sops,      setSops]      = useState<SopRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [subView, setSubView] = useState<SubView>("active");

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [baselineIds, setBaselineIds] = useState<Set<number>>(new Set());
  const [baselineWeekKey, setBaselineWeekKey] = useState<string | null>(null);

  const [archivingId, setArchivingId] = useState<number | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [saveMsg,  setSaveMsg]  = useState<string | null>(null);
  const [saveErr,  setSaveErr]  = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [sopsRes, enfRes] = await Promise.all([
        fetch("/api/session/sops"),
        fetch("/api/session/sops/enforcements"),
      ]);
      if (!sopsRes.ok) throw new Error((await sopsRes.json().catch(() => ({})))?.error ?? "Failed to load SOP checklists");
      if (!enfRes.ok) throw new Error((await enfRes.json().catch(() => ({})))?.error ?? "Failed to load enforcement plan");

      const sopsJson = await sopsRes.json();
      const enfJson  = await enfRes.json();

      setSops(sopsJson.rows ?? []);
      const ids = new Set<number>((enfJson.sops ?? []).map((s: SopRow) => s.id));
      setSelectedIds(ids);
      setBaselineIds(ids);
      setBaselineWeekKey(enfJson.weekKey ?? null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => sops.filter(s => s.status === subView), [sops, subView]);

  const grouped = useMemo(() => {
    const groups = new Map<string, SopRow[]>();
    for (const s of filtered) {
      const key = s.tags[0] ?? "Untagged";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const toggleSelected = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const setStatus = async (id: number, status: "active" | "archived") => {
    setArchivingId(id);
    try {
      const r = await fetch(`/api/session/sops/${id}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error();
      setSops(prev => prev.map(s => s.id === id ? { ...s, status } : s));
      // Archiving a SOP that's staged for enforcement makes no sense — drop it.
      if (status === "archived") setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    } catch {
      setSaveErr("Failed to update that checklist's status");
    }
    setArchivingId(null);
  };

  const dirty = useMemo(() => {
    if (selectedIds.size !== baselineIds.size) return true;
    for (const id of selectedIds) if (!baselineIds.has(id)) return true;
    return false;
  }, [selectedIds, baselineIds]);

  const handleRevert = () => { setSelectedIds(new Set(baselineIds)); setSaveMsg(null); setSaveErr(null); };

  const handleSubmit = async () => {
    setSaving(true);
    setSaveMsg(null);
    setSaveErr(null);
    try {
      const r = await fetch("/api/session/sops/enforcements", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sopIds: [...selectedIds] }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? "Failed to save");
      setBaselineIds(new Set(selectedIds));
      setBaselineWeekKey(j.weekKey ?? baselineWeekKey);
      setSaveMsg(
        j.titles?.length
          ? `Enforced ${j.titles.length} SOP${j.titles.length !== 1 ? "s" : ""}: ${j.titles.join(", ")}.`
          : "Cleared all enforced SOPs."
      );
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Failed to save");
    }
    setSaving(false);
  };

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}><Spinner size={22} /></div>;
  }
  if (loadError) {
    return <p style={{ color: "var(--red)", fontSize: 12.5, textAlign: "center", padding: "24px 0" }}>{loadError}</p>;
  }

  return (
    <div>
      {/* Session governance — moved here from the session page's analyst
          view so every operator-facing "enforce X" control lives in one
          place alongside SOP enforcement. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span className="mono" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", color: "var(--ink-3)", textTransform: "uppercase" as const }}>
          Session Controls
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        <EntryChecklistToggle />
        <AttentionChallengeToggle />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span className="mono" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", color: "var(--ink-3)", textTransform: "uppercase" as const }}>
          SOP Checklists
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
      </div>

      {/* Sub-toggle: Active / Archived */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {(["active", "archived"] as const).map(v => {
          const active = subView === v;
          return (
            <button
              key={v}
              onClick={() => setSubView(v)}
              className="mono"
              style={{
                padding: "6px 14px", borderRadius: 6,
                border: `1px solid ${active ? "var(--green)" : "var(--line)"}`,
                background: active ? "rgba(0,204,122,0.10)" : "transparent",
                color: active ? "var(--green)" : "var(--ink-2)",
                fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", cursor: "pointer",
              }}
            >
              {v.toUpperCase()} ({sops.filter(s => s.status === v).length})
            </button>
          );
        })}
      </div>

      <p style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 14 }}>
        {subView === "active"
          ? "Tick which checklists operators should complete. Takes effect as soon as you submit."
          : "Archived checklists can't be enforced — reactivate one to make it available again."}
      </p>

      {filtered.length === 0 && (
        <p style={{ color: "var(--ink-3)", fontSize: 12.5, textAlign: "center", padding: "24px 0" }}>
          No {subView} SOP checklists.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {grouped.map(([tag, rows]) => (
          <div key={tag}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span className="mono" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", color: "var(--ink-3)", textTransform: "uppercase" as const }}>
                {tag}
              </span>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rows.map(s => (
                <div key={s.id} className="card" style={{ padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                  {subView === "active" && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleSelected(s.id)}
                      style={{ marginTop: 3, flexShrink: 0, cursor: "pointer", width: 15, height: 15, accentColor: "var(--green)" }}
                      aria-label={`Enforce ${s.title}`}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--ink-0)" }}>{s.title}</p>
                    <p style={{ margin: "3px 0 0", fontSize: 10.5, color: "var(--ink-3)" }}>
                      {s.items.length} row{s.items.length !== 1 ? "s" : ""}
                    </p>
                    {s.tags.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
                        {s.tags.map(t => <span key={t} className="chip chip-muted">{t}</span>)}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={archivingId === s.id}
                    onClick={() => setStatus(s.id, subView === "active" ? "archived" : "active")}
                    className="btn btn-ghost"
                    style={{ fontSize: 10.5, padding: "6px 10px", flexShrink: 0, opacity: archivingId === s.id ? 0.6 : 1 }}
                  >
                    {archivingId === s.id ? <Spinner size={11} /> : subView === "active" ? "Archive" : "Activate"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Submit / Revert */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
        <button type="button" onClick={handleSubmit} disabled={saving || !dirty} className="btn btn-primary" style={{ opacity: !dirty ? 0.5 : 1 }}>
          {saving ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Spinner /> Submitting…</span> : "Submit"}
        </button>
        <button type="button" onClick={handleRevert} disabled={saving || !dirty} className="btn btn-ghost" style={{ opacity: !dirty ? 0.5 : 1 }}>
          Revert
        </button>
        <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
          {selectedIds.size} selected
        </span>
        {saveMsg && <span style={{ fontSize: 11.5, color: "var(--green)", marginLeft: "auto" }}>✓ {saveMsg}</span>}
        {saveErr && <span style={{ fontSize: 11.5, color: "var(--red)", marginLeft: "auto" }}>{saveErr}</span>}
      </div>
    </div>
  );
}
