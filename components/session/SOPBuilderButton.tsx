"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import type { SopRow } from "@/lib/sopTypes";

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden style={{ animation: "spin-sop 0.7s linear infinite", flexShrink: 0 }}>
      <style>{`@keyframes spin-sop { to { transform: rotate(360deg); } }`}</style>
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5"/>
      <path d="M7 1.5a5.5 5.5 0 0 1 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

const MIN_ROWS = 1;
const MAX_ROWS = 12;

/* Flat outlined action style — matches the FLAT_SUBMIT convention used
   across the session/governance forms instead of the solid .btn-primary fill. */
const FLAT_SUBMIT: React.CSSProperties = {
  fontFamily: "var(--font-mono), monospace", textTransform: "lowercase",
  background: "transparent", border: "1px solid rgba(0,204,122,0.35)",
  borderRadius: 5, color: "var(--green)", fontWeight: 700,
  padding: "9px 16px", fontSize: 12.5, cursor: "pointer",
};

type View = "list" | "builder";

/**
 * Strategist-only SOP checklist library. Self-contained: fetches its own
 * data, renders its own trigger button (or nothing, if the current user
 * isn't a strategist/fund_manager), and manages create/edit/delete against
 * /api/session/sops — no props, no wiring needed from the host page.
 */
export default function SOPBuilderButton() {
  const { data: session } = useSession();
  const roles: string[] = (session as any)?.roles ?? [];
  const canBuild = roles.some(r => ["strategist", "fund_manager"].includes(r));

  const [open,       setOpen]       = useState(false);
  const [view,        setView]        = useState<View>("list");
  const [sops,        setSops]        = useState<SopRow[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [listError,   setListError]   = useState<string | null>(null);

  /* Builder form state */
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title,      setTitle]      = useState("");
  const [items,      setItems]      = useState<string[]>([""]);
  const [tags,       setTags]       = useState<string[]>([]);
  const [tagDraft,   setTagDraft]   = useState("");
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const fetchSops = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const r = await fetch("/api/session/sops");
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "Failed to load");
      const j = await r.json();
      setSops(j.rows ?? []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to load SOP checklists");
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (open && view === "list") void fetchSops(); }, [open, view, fetchSops]);

  if (!canBuild) return null;

  const resetForm = () => {
    setEditingId(null); setTitle(""); setItems([""]); setTags([]); setTagDraft(""); setFormError(null);
  };

  const openNew = () => { resetForm(); setView("builder"); };

  const openEdit = (s: SopRow) => {
    setEditingId(s.id);
    setTitle(s.title);
    setItems(s.items.length ? s.items : [""]);
    setTags(s.tags);
    setTagDraft("");
    setFormError(null);
    setView("builder");
  };

  const addRow    = () => setItems(prev => prev.length < MAX_ROWS ? [...prev, ""] : prev);
  const removeRow = (i: number) => setItems(prev => prev.length > MIN_ROWS ? prev.filter((_, idx) => idx !== i) : prev);
  const setRow    = (i: number, v: string) => setItems(prev => prev.map((it, idx) => idx === i ? v : it));

  const commitTagDraft = () => {
    const t = tagDraft.trim();
    setTagDraft("");
    if (!t) return;
    setTags(prev => prev.some(x => x.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t]);
  };
  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t));

  const handleSave = async () => {
    setFormError(null);
    const cleanItems = items.map(i => i.trim()).filter(Boolean);
    if (cleanItems.length < MIN_ROWS) { setFormError("At least 1 checklist row is required"); return; }
    if (cleanItems.length > MAX_ROWS) { setFormError(`At most ${MAX_ROWS} checklist rows are allowed`); return; }
    if (!title.trim()) { setFormError("Title is required"); return; }

    setSaving(true);
    try {
      const payload = { title: title.trim(), tags, items: cleanItems };
      const url    = editingId ? `/api/session/sops/${editingId}` : "/api/session/sops";
      const method = editingId ? "PUT" : "POST";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error ?? "Failed to save");
      }
      await fetchSops();
      setView("list");
      resetForm();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save");
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    try {
      const r = await fetch(`/api/session/sops/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to delete");
      setSops(prev => prev.filter(s => s.id !== id));
    } catch {
      setListError("Failed to delete SOP checklist");
    }
    setDeleteConfirmId(null);
  };

  const close = () => { setOpen(false); setView("list"); resetForm(); setDeleteConfirmId(null); };

  return (
    <>
      <button className="btn btn-secondary" onClick={() => setOpen(true)}>
        SOP Builder
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          onClick={close}
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
                <p className="section-eyebrow" style={{ margin: "0 0 4px" }}>SOP Builder</p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--ink-0)" }}>
                  {view === "list" ? "Standard Operating Procedures" : editingId ? "Edit SOP Checklist" : "New SOP Checklist"}
                </p>
              </div>
              <button
                type="button" onClick={close} aria-label="Close"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 18, lineHeight: 1, padding: 4 }}
              >
                ✕
              </button>
            </div>

            {/* ── List view ─────────────────────────────── */}
            {view === "list" && (
              <>
                <button type="button" onClick={openNew} style={{ ...FLAT_SUBMIT, marginBottom: 16 }}>
                  + new sop
                </button>

                {loading && (
                  <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}><Spinner size={20} /></div>
                )}
                {!loading && listError && (
                  <p style={{ color: "var(--red)", fontSize: 12.5 }}>{listError}</p>
                )}
                {!loading && !listError && sops.length === 0 && (
                  <p style={{ color: "var(--ink-3)", fontSize: 12.5, textAlign: "center", padding: "24px 0" }}>
                    No SOP checklists yet. Create your first one.
                  </p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {sops.map(s => (
                    <div key={s.id} className="card" style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "var(--ink-0)" }}>{s.title}</p>
                          <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--ink-3)" }}>
                            {s.items.length} row{s.items.length !== 1 ? "s" : ""} · updated {new Date(s.updated_at).toLocaleDateString()}
                          </p>
                          {s.tags.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                              {s.tags.map(t => <span key={t} className="chip chip-muted">{t}</span>)}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button type="button" onClick={() => openEdit(s)} className="btn btn-ghost" style={{ fontSize: 11, padding: "6px 10px" }}>
                            Edit
                          </button>
                          {deleteConfirmId === s.id ? (
                            <button
                              type="button" onClick={() => handleDelete(s.id)} className="btn btn-ghost"
                              style={{ fontSize: 11, padding: "6px 10px", color: "var(--red)", borderColor: "rgba(240,58,87,0.35)" }}
                            >
                              Confirm?
                            </button>
                          ) : (
                            <button type="button" onClick={() => setDeleteConfirmId(s.id)} className="btn btn-ghost" style={{ fontSize: 11, padding: "6px 10px" }}>
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── Builder view ──────────────────────────── */}
            {view === "builder" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Title */}
                <div>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--ink-3)", textTransform: "uppercase" as const, marginBottom: 6 }}>
                    Title
                  </label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Pre-Entry Guard Verification"
                    maxLength={200}
                    style={{ width: "100%", boxSizing: "border-box", background: "var(--sub)", border: "1px solid var(--line-hi)", borderRadius: 6, padding: "10px 12px", fontSize: 13, color: "var(--ink-0)", outline: "none" }}
                  />
                </div>

                {/* Tags */}
                <div>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--ink-3)", textTransform: "uppercase" as const, marginBottom: 6 }}>
                    Tags
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", background: "var(--sub)", border: "1px solid var(--line-hi)", borderRadius: 6, padding: "8px 10px" }}>
                    {tags.map(t => (
                      <span key={t} className="chip chip-green" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        {t}
                        <button
                          type="button" onClick={() => removeTag(t)} aria-label={`Remove tag ${t}`}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1, fontSize: 11 }}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    <input
                      value={tagDraft}
                      onChange={e => setTagDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commitTagDraft(); }
                        else if (e.key === "Backspace" && !tagDraft && tags.length > 0) { setTags(prev => prev.slice(0, -1)); }
                      }}
                      onBlur={commitTagDraft}
                      placeholder={tags.length === 0 ? "Type a tag, press Enter…" : ""}
                      style={{ flex: 1, minWidth: 100, background: "none", border: "none", outline: "none", fontSize: 12.5, color: "var(--ink-0)" }}
                    />
                  </div>
                </div>

                {/* Checklist rows */}
                <div>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--ink-3)", textTransform: "uppercase" as const, marginBottom: 6 }}>
                    Checklist Rows ({items.length}/{MAX_ROWS})
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {items.map((it, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 20, textAlign: "center", fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--ink-3)", flexShrink: 0 }}>
                          {i + 1}
                        </span>
                        <input
                          value={it}
                          onChange={e => setRow(i, e.target.value)}
                          placeholder={`Row ${i + 1}…`}
                          maxLength={300}
                          style={{ flex: 1, minWidth: 0, background: "var(--sub)", border: "1px solid var(--line-hi)", borderRadius: 6, padding: "8px 10px", fontSize: 12.5, color: "var(--ink-0)", outline: "none" }}
                        />
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          disabled={items.length <= MIN_ROWS}
                          aria-label={`Remove row ${i + 1}`}
                          style={{
                            width: 26, height: 26, flexShrink: 0, borderRadius: 6,
                            background: "none", border: "1px solid var(--line)",
                            color: items.length <= MIN_ROWS ? "var(--ink-4)" : "var(--red)",
                            cursor: items.length <= MIN_ROWS ? "not-allowed" : "pointer",
                            opacity: items.length <= MIN_ROWS ? 0.4 : 1,
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
                    onClick={addRow}
                    disabled={items.length >= MAX_ROWS}
                    className="btn btn-ghost"
                    style={{ marginTop: 8, fontSize: 11.5, padding: "7px 14px", opacity: items.length >= MAX_ROWS ? 0.45 : 1, cursor: items.length >= MAX_ROWS ? "not-allowed" : "pointer" }}
                  >
                    + Add row
                  </button>
                </div>

                {formError && <p style={{ color: "var(--red)", fontSize: 12, margin: 0 }}>{formError}</p>}

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                  <button type="button" onClick={() => { setView("list"); resetForm(); }} className="btn btn-ghost">
                    Cancel
                  </button>
                  <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
                    {saving
                      ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Spinner /> Saving…</span>
                      : editingId ? "Save Changes" : "Create SOP"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
