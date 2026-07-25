"use client";

import { useState, useEffect, useCallback } from "react";
import type { SopRow } from "@/lib/sopTypes";
import { readCache, writeCache } from "@/lib/staleCache";

const CACHE_KEY = "xtnl_enforced_sops_cache_v1";

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden style={{ animation: "spin-esop 0.7s linear infinite", flexShrink: 0 }}>
      <style>{`@keyframes spin-esop { to { transform: rotate(360deg); } }`}</style>
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5"/>
      <path d="M7 1.5a5.5 5.5 0 0 1 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/**
 * Operator's "Enforce SOP" tab (session page, operator view sidebar).
 * Shows one button per SOP checklist the strategist enforced for the
 * current week; clicking one brings up its checklist (only one shown at a
 * time). Each row is its own checkbox — every row must be ticked before
 * Submit is enabled, so the operator actually confirms each step rather
 * than blanket-submitting. Submit logs a comment recording completion.
 *
 * Stale-while-revalidate: this list only changes once or twice a week (a
 * strategist's Enforce SOP submit), so a loading spinner on every visit is
 * wasted time. Whatever was last synced renders instantly from
 * localStorage; the real fetch still runs in the background and silently
 * reconciles the view when it resolves.
 */
export default function EnforceSopOperatorPanel({ onSuccess }: { onSuccess?: () => void }) {
  const [sops,       setSops]       = useState<SopRow[]>(() => readCache<SopRow[]>(CACHE_KEY) ?? []);
  const [loading,    setLoading]    = useState(() => readCache<SopRow[]>(CACHE_KEY) === null);
  const [syncing,    setSyncing]    = useState(false);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    const hadCache = readCache<SopRow[]>(CACHE_KEY) !== null;
    if (hadCache) setSyncing(true); else setLoading(true);
    setLoadError(null);
    try {
      const r = await fetch("/api/session/sops/enforcements");
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "Failed to load");
      const j = await r.json();
      const fresh: SopRow[] = j.sops ?? [];
      setSops(fresh);
      writeCache(CACHE_KEY, fresh);
      // A SOP that's no longer enforced shouldn't stay "open".
      setSelectedId(prev => (prev !== null && fresh.some(s => s.id === prev)) ? prev : null);
    } catch (e) {
      // Cached data is still useful and was already rendered — only
      // surface a hard error when there's nothing to fall back on.
      if (!hadCache) setLoadError(e instanceof Error ? e.message : "Failed to load enforced SOPs");
    }
    setLoading(false);
    setSyncing(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selected = sops.find(s => s.id === selectedId) ?? null;

  /* Fresh review each time a SOP is opened — don't carry over ticks from
     whichever checklist was open before. */
  useEffect(() => { setCheckedItems(new Set()); }, [selectedId]);

  const toggleItem = (i: number) => setCheckedItems(prev => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  const allChecked = !!selected && selected.items.length > 0 && selected.items.every((_, i) => checkedItems.has(i));

  const handleSubmit = async () => {
    if (!selected || !allChecked) return;
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const r = await fetch("/api/session/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: `Completed SOP checklist: "${selected.title}"`, created_at: now }),
      });
      if (!r.ok) throw new Error();
      setCompletedIds(prev => new Set(prev).add(selected.id));
      onSuccess?.();
    } catch {
      /* silent — the button stays enabled so the operator can just retry */
    }
    setSubmitting(false);
  };

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}><Spinner size={20} /></div>;
  }
  if (loadError) {
    return <p style={{ color: "var(--red)", fontSize: 12, textAlign: "center", padding: "16px 0" }}>{loadError}</p>;
  }
  if (sops.length === 0) {
    return (
      <p style={{ color: "var(--ink-3)", fontSize: 12, textAlign: "center", padding: "24px 0", lineHeight: 1.6 }}>
        No SOP checklists are enforced this week.
      </p>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {sops.map(s => {
          const active = s.id === selectedId;
          const done   = completedIds.has(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedId(s.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 6,
                border: `1px solid ${active ? "var(--green)" : "var(--line-hi)"}`,
                background: active ? "rgba(0,204,122,0.10)" : "var(--sub)",
                color: active ? "var(--green)" : done ? "var(--ink-3)" : "var(--ink-1)",
                fontSize: 11.5, fontWeight: active ? 700 : 500, cursor: "pointer",
              }}
            >
              {done && <span style={{ color: "var(--green)" }}>✓</span>}
              {s.title}
            </button>
          );
        })}
        {syncing && (
          <span title="Syncing latest enforced SOPs…" style={{ display: "inline-flex", color: "var(--ink-4)" }}>
            <Spinner size={12} />
          </span>
        )}
      </div>

      {selected && (
        <div className="card" style={{ padding: "14px 16px" }}>
          <p style={{ margin: "0 0 10px", fontSize: 13.5, fontWeight: 700, color: "var(--ink-0)" }}>{selected.title}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
            {selected.items.map((item, i) => {
              const checked = checkedItems.has(i);
              return (
                <label
                  key={i}
                  style={{
                    display: "flex", gap: 9, alignItems: "flex-start",
                    padding: "6px 8px", borderRadius: 5, cursor: "pointer",
                    background: checked ? "rgba(0,204,122,0.06)" : "transparent",
                    transition: "background 0.15s",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleItem(i)}
                    style={{ marginTop: 3, flexShrink: 0, cursor: "pointer", width: 15, height: 15, accentColor: "var(--green)" }}
                  />
                  <p style={{ margin: 0, fontSize: 12.5, color: checked ? "var(--ink-0)" : "var(--ink-1)", lineHeight: 1.6 }}>{item}</p>
                </label>
              );
            })}
          </div>
          {!allChecked && (
            <p style={{ margin: "0 0 10px", fontSize: 10.5, color: "var(--ink-3)", textAlign: "center" }}>
              Tick every row to enable Submit ({checkedItems.size}/{selected.items.length})
            </p>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !allChecked}
            className="btn btn-primary"
            style={{ width: "100%", opacity: submitting || !allChecked ? 0.5 : 1 }}
          >
            {submitting
              ? <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}><Spinner /> Submitting…</span>
              : completedIds.has(selected.id) ? "Submit again" : "Submit"}
          </button>
          {completedIds.has(selected.id) && (
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--green)", textAlign: "center" }}>✓ Logged as completed</p>
          )}
        </div>
      )}
    </div>
  );
}
