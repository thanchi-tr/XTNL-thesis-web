"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import type { SopRow } from "@/lib/sopTypes";
import { EntryChecklistToggle, AttentionChallengeToggle } from "@/components/session/AnalystToggles";
import { readCache, writeCache } from "@/lib/staleCache";

const MIN_ROWS = 1;
const MAX_ROWS = 12;

const SOPS_CACHE_KEY   = "xtnl_sop_checklists_cache_v1";
const BASELINE_CACHE_KEY = "xtnl_sop_enforcement_baseline_cache_v1";

interface BaselineCache { ids: number[]; weekKey: string | null }

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
 *
 * Stale-while-revalidate: both the SOP library and the enforcement
 * baseline change at most a couple of times a week, so this renders
 * whatever was last synced from localStorage instantly and reconciles
 * against the server in the background rather than blocking on a
 * spinner every visit. A successful Submit writes straight through to
 * the cache too, so the strategist's own next visit is never stale
 * behind their own action.
 */
export default function EnforceSopManager() {
  const { data: session } = useSession();
  const roles: string[] = (session as any)?.roles ?? [];
  const canEdit = roles.includes("strategist");

  const [sops,      setSops]      = useState<SopRow[]>(() => readCache<SopRow[]>(SOPS_CACHE_KEY) ?? []);
  const [loading,   setLoading]   = useState(() => readCache<SopRow[]>(SOPS_CACHE_KEY) === null);
  const [syncing,   setSyncing]   = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  /* Detail popup */
  const [detailSop,  setDetailSop]  = useState<SopRow | null>(null);
  const [detailMode, setDetailMode] = useState<"view" | "edit">("view");
  const [editTitle,  setEditTitle]  = useState("");
  const [editItems,  setEditItems]  = useState<string[]>([""]);
  const [editTags,   setEditTags]   = useState<string[]>([]);
  const [editTagDraft, setEditTagDraft] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError,  setEditError]  = useState<string | null>(null);

  const [subView, setSubView] = useState<SubView>("active");

  const cachedBaseline = readCache<BaselineCache>(BASELINE_CACHE_KEY);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set(cachedBaseline?.ids ?? []));
  const [baselineIds, setBaselineIds] = useState<Set<number>>(new Set(cachedBaseline?.ids ?? []));
  const [baselineWeekKey, setBaselineWeekKey] = useState<string | null>(cachedBaseline?.weekKey ?? null);

  const [archivingId, setArchivingId] = useState<number | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [saveMsg,  setSaveMsg]  = useState<string | null>(null);
  const [saveErr,  setSaveErr]  = useState<string | null>(null);

  const load = useCallback(async () => {
    const hadCache = readCache<SopRow[]>(SOPS_CACHE_KEY) !== null;
    if (hadCache) setSyncing(true); else setLoading(true);
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

      const freshSops: SopRow[] = sopsJson.rows ?? [];
      setSops(freshSops);
      writeCache(SOPS_CACHE_KEY, freshSops);

      const ids = new Set<number>((enfJson.sops ?? []).map((s: SopRow) => s.id));
      setSelectedIds(ids);
      setBaselineIds(ids);
      setBaselineWeekKey(enfJson.weekKey ?? null);
      writeCache<BaselineCache>(BASELINE_CACHE_KEY, { ids: [...ids], weekKey: enfJson.weekKey ?? null });
    } catch (e) {
      // Cached data already rendered — only block with an error if we had
      // nothing to fall back on.
      if (!hadCache) setLoadError(e instanceof Error ? e.message : "Failed to load");
    }
    setLoading(false);
    setSyncing(false);
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
      const nextSops = sops.map(s => s.id === id ? { ...s, status } : s);
      setSops(nextSops);
      writeCache(SOPS_CACHE_KEY, nextSops);
      // Archiving a SOP that's staged for enforcement makes no sense — drop it.
      if (status === "archived") setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    } catch {
      setSaveErr("Failed to update that checklist's status");
    }
    setArchivingId(null);
  };

  const openDetail = (s: SopRow) => {
    setDetailSop(s);
    setDetailMode("view");
    setEditError(null);
  };
  const closeDetail = () => { setDetailSop(null); setDetailMode("view"); setEditError(null); };

  const startEdit = () => {
    if (!detailSop) return;
    setEditTitle(detailSop.title);
    setEditItems(detailSop.items.length ? [...detailSop.items] : [""]);
    setEditTags([...detailSop.tags]);
    setEditTagDraft("");
    setEditError(null);
    setDetailMode("edit");
  };

  const addEditRow    = () => setEditItems(prev => prev.length < MAX_ROWS ? [...prev, ""] : prev);
  const removeEditRow = (i: number) => setEditItems(prev => prev.length > MIN_ROWS ? prev.filter((_, idx) => idx !== i) : prev);
  const setEditRow    = (i: number, v: string) => setEditItems(prev => prev.map((it, idx) => idx === i ? v : it));

  const commitEditTagDraft = () => {
    const t = editTagDraft.trim();
    setEditTagDraft("");
    if (!t) return;
    setEditTags(prev => prev.some(x => x.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t]);
  };
  const removeEditTag = (t: string) => setEditTags(prev => prev.filter(x => x !== t));

  const saveEdit = async () => {
    if (!detailSop) return;
    setEditError(null);
    const cleanItems = editItems.map(i => i.trim()).filter(Boolean);
    if (cleanItems.length < MIN_ROWS) { setEditError("At least 1 checklist row is required"); return; }
    if (cleanItems.length > MAX_ROWS) { setEditError(`At most ${MAX_ROWS} checklist rows are allowed`); return; }
    if (!editTitle.trim()) { setEditError("Title is required"); return; }

    setEditSaving(true);
    try {
      const payload = { title: editTitle.trim(), tags: editTags, items: cleanItems };
      const r = await fetch(`/api/session/sops/${detailSop.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error ?? "Failed to save");
      }
      const j = await r.json().catch(() => ({}));
      const updated: SopRow = j.row ?? { ...detailSop, ...payload, updated_at: new Date().toISOString() };
      const nextSops = sops.map(s => s.id === detailSop.id ? updated : s);
      setSops(nextSops);
      writeCache(SOPS_CACHE_KEY, nextSops);
      setDetailSop(updated);
      setDetailMode("view");
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to save");
    }
    setEditSaving(false);
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
      const newIds = new Set(selectedIds);
      const newWeekKey = j.weekKey ?? baselineWeekKey;
      setBaselineIds(newIds);
      setBaselineWeekKey(newWeekKey);
      // Write-through immediately — don't wait for the next background
      // sync to reflect the strategist's own just-submitted change.
      writeCache<BaselineCache>(BASELINE_CACHE_KEY, { ids: [...newIds], weekKey: newWeekKey });
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
        {syncing && <span title="Syncing…" style={{ display: "inline-flex", color: "var(--ink-4)" }}><Spinner size={12} /></span>}
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
                      onClick={e => e.stopPropagation()}
                      style={{ marginTop: 3, flexShrink: 0, cursor: "pointer", width: 15, height: 15, accentColor: "var(--green)" }}
                      aria-label={`Enforce ${s.title}`}
                    />
                  )}
                  <div
                    onClick={() => openDetail(s)}
                    style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                  >
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
                    onClick={e => { e.stopPropagation(); setStatus(s.id, subView === "active" ? "archived" : "active"); }}
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

      {/* SOP detail / edit popup */}
      {detailSop && typeof document !== "undefined" && createPortal(
        <div
          onClick={closeDetail}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
            display: "flex", alignItems: "flex-start", justifyContent: "center",
            padding: "48px 20px", overflowY: "auto",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 640,
              background: "var(--card)", border: "1px solid var(--line)",
              borderRadius: 10, boxShadow: "0 8px 56px rgba(0,0,0,0.72)",
              padding: 28,
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <p className="section-eyebrow" style={{ margin: "0 0 4px" }}>SOP Checklist</p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--ink-0)" }}>
                  {detailMode === "edit" ? "Edit SOP Checklist" : detailSop.title}
                </p>
              </div>
              <button
                type="button" onClick={closeDetail} aria-label="Close"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 18, lineHeight: 1, padding: 4 }}
              >
                ✕
              </button>
            </div>

            {/* ── View mode ─────────────────────────────── */}
            {detailMode === "view" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--ink-3)" }}>
                  <span>Status: <strong style={{ color: "var(--ink-1)" }}>{detailSop.status}</strong></span>
                  <span>Updated {new Date(detailSop.updated_at).toLocaleString()}</span>
                </div>

                {detailSop.tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {detailSop.tags.map(t => <span key={t} className="chip chip-muted">{t}</span>)}
                  </div>
                )}

                <div>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--ink-3)", textTransform: "uppercase" as const, marginBottom: 8 }}>
                    Checklist Rows
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {detailSop.items.map((it, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{ width: 20, textAlign: "center", fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--ink-3)", flexShrink: 0 }}>
                          {i + 1}
                        </span>
                        <span style={{ fontSize: 12.5, color: "var(--ink-1)" }}>{it}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                  <button type="button" onClick={closeDetail} className="btn btn-ghost">Close</button>
                  {canEdit && (
                    <button type="button" onClick={startEdit} className="btn btn-primary">Edit</button>
                  )}
                </div>
              </div>
            )}

            {/* ── Edit mode (strategist only) ───────────── */}
            {detailMode === "edit" && canEdit && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--ink-3)", textTransform: "uppercase" as const, marginBottom: 6 }}>
                    Title
                  </label>
                  <input
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    maxLength={200}
                    style={{ width: "100%", boxSizing: "border-box", background: "var(--sub)", border: "1px solid var(--line-hi)", borderRadius: 6, padding: "10px 12px", fontSize: 13, color: "var(--ink-0)", outline: "none" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--ink-3)", textTransform: "uppercase" as const, marginBottom: 6 }}>
                    Tags
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", background: "var(--sub)", border: "1px solid var(--line-hi)", borderRadius: 6, padding: "8px 10px" }}>
                    {editTags.map(t => (
                      <span key={t} className="chip chip-green" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        {t}
                        <button
                          type="button" onClick={() => removeEditTag(t)} aria-label={`Remove tag ${t}`}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1, fontSize: 11 }}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    <input
                      value={editTagDraft}
                      onChange={e => setEditTagDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commitEditTagDraft(); }
                        else if (e.key === "Backspace" && !editTagDraft && editTags.length > 0) { setEditTags(prev => prev.slice(0, -1)); }
                      }}
                      onBlur={commitEditTagDraft}
                      placeholder={editTags.length === 0 ? "Type a tag, press Enter…" : ""}
                      style={{ flex: 1, minWidth: 100, background: "none", border: "none", outline: "none", fontSize: 12.5, color: "var(--ink-0)" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--ink-3)", textTransform: "uppercase" as const, marginBottom: 6 }}>
                    Checklist Rows ({editItems.length}/{MAX_ROWS})
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {editItems.map((it, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 20, textAlign: "center", fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--ink-3)", flexShrink: 0 }}>
                          {i + 1}
                        </span>
                        <input
                          value={it}
                          onChange={e => setEditRow(i, e.target.value)}
                          placeholder={`Row ${i + 1}…`}
                          maxLength={300}
                          style={{ flex: 1, minWidth: 0, background: "var(--sub)", border: "1px solid var(--line-hi)", borderRadius: 6, padding: "8px 10px", fontSize: 12.5, color: "var(--ink-0)", outline: "none" }}
                        />
                        <button
                          type="button"
                          onClick={() => removeEditRow(i)}
                          disabled={editItems.length <= MIN_ROWS}
                          aria-label={`Remove row ${i + 1}`}
                          style={{
                            width: 26, height: 26, flexShrink: 0, borderRadius: 6,
                            background: "none", border: "1px solid var(--line)",
                            color: editItems.length <= MIN_ROWS ? "var(--ink-4)" : "var(--red)",
                            cursor: editItems.length <= MIN_ROWS ? "not-allowed" : "pointer",
                            opacity: editItems.length <= MIN_ROWS ? 0.4 : 1,
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addEditRow}
                    disabled={editItems.length >= MAX_ROWS}
                    className="btn btn-ghost"
                    style={{ marginTop: 8, fontSize: 11.5, padding: "7px 14px", opacity: editItems.length >= MAX_ROWS ? 0.45 : 1, cursor: editItems.length >= MAX_ROWS ? "not-allowed" : "pointer" }}
                  >
                    + Add row
                  </button>
                </div>

                {editError && <p style={{ color: "var(--red)", fontSize: 12, margin: 0 }}>{editError}</p>}

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                  <button type="button" onClick={() => setDetailMode("view")} className="btn btn-ghost">Cancel</button>
                  <button type="button" onClick={saveEdit} disabled={editSaving} className="btn btn-primary">
                    {editSaving
                      ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Spinner /> Saving…</span>
                      : "Save Changes"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
