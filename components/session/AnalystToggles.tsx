"use client";

import { useState, useEffect, useCallback } from "react";

type ShowToast = (kind: "success" | "error", text: string) => void;

interface AnalystToggleProps {
  showToast?: ShowToast;
  label: string;
  subOn: string;
  subOff: string;
  fetchKey: string;
  apiAction: string;
  locked?: boolean;
  refreshSignal?: number;
  commentLabel: string;
}

function AnalystToggle({
  showToast, label, subOn, subOff, fetchKey, apiAction, locked, refreshSignal, commentLabel,
}: AnalystToggleProps) {
  const [enabled, setEnabled] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchState = useCallback(() => {
    fetch("/api/session/alarm")
      .then(r => r.json())
      .then((s: Record<string, unknown>) => {
        if (typeof s[fetchKey] === "boolean") setEnabled(s[fetchKey] as boolean);
      })
      .catch(() => {});
  }, [fetchKey]);

  useEffect(() => { fetchState(); }, [fetchState]);
  useEffect(() => { if ((refreshSignal ?? 0) > 0) fetchState(); }, [refreshSignal, fetchState]);

  const toggle = async () => {
    if (syncing || locked) return;
    setSyncing(true);
    const next = !enabled;
    setEnabled(next);
    try {
      const r = await fetch("/api/session/alarm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: apiAction }),
      });
      const s = await r.json() as Record<string, unknown>;
      if (typeof s[fetchKey] === "boolean") setEnabled(s[fetchKey] as boolean);
      if (next) {
        const now = new Date().toISOString();
        void fetch("/api/session/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: `friction enforce: ${commentLabel}`, created_at: now }),
        });
      }
    } catch {
      setEnabled(!next);
      showToast?.("error", `Failed to update setting`);
    } finally {
      setSyncing(false);
    }
  };

  const isOn = locked || enabled;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 14px", borderRadius: 6,
      background: isOn ? "rgba(0,204,122,0.07)" : "var(--sub)",
      outline: `1px solid ${locked ? "rgba(220,60,60,0.4)" : isOn ? "rgba(0,204,122,0.25)" : "var(--line-hi)"}`,
      transition: "background 0.2s, outline-color 0.2s",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: locked ? "var(--red)" : isOn ? "var(--green)" : "var(--ink-1)", letterSpacing: "0.01em" }}>
          {label}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 9.5, color: "var(--ink-4)" }}>
          {locked ? "⚠ System locked — drift threshold breached" : isOn ? subOn : subOff}
        </p>
      </div>
      <button
        type="button"
        disabled={syncing || locked}
        onClick={() => { void toggle(); }}
        aria-label={isOn ? `Disable ${label}` : `Enable ${label}`}
        style={{
          width: 38, height: 22, borderRadius: 11, flexShrink: 0, marginLeft: 10,
          background: isOn ? (locked ? "var(--red)" : "var(--green)") : "var(--raised)",
          border: `1px solid ${locked ? "rgba(220,60,60,0.5)" : "var(--line-hi)"}`,
          cursor: locked ? "not-allowed" : syncing ? "wait" : "pointer",
          position: "relative",
          transition: "background 0.2s",
        }}
      >
        {locked
          ? <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff" }}>🔒</span>
          : <span style={{
              display: "block", width: 16, height: 16, borderRadius: "50%",
              background: isOn ? "#04080F" : "var(--ink-3)",
              position: "absolute", top: 2, left: isOn ? 18 : 2,
              transition: "left 0.2s",
            }} />
        }
      </button>
    </div>
  );
}

export function EntryChecklistToggle({ showToast, locked, refreshSignal }: { showToast?: ShowToast; locked?: boolean; refreshSignal?: number }) {
  return (
    <AnalystToggle
      showToast={showToast}
      label="Detail anchor log for target SOP"
      subOn="Operator can submit entry plan"
      subOff="Entry checklist hidden from operator"
      fetchKey="entry_checklist_enabled"
      apiAction="toggle_entry_checklist"
      commentLabel="Detail anchor log for target SOP"
      locked={locked}
      refreshSignal={refreshSignal}
    />
  );
}

export function AttentionChallengeToggle({ showToast, locked, refreshSignal }: { showToast?: ShowToast; locked?: boolean; refreshSignal?: number }) {
  return (
    <AnalystToggle
      showToast={showToast}
      label="Watch challenge to enforce focus"
      subOn="Watch tap challenge active"
      subOff="Tap challenge disabled"
      fetchKey="enforce_focus"
      apiAction="toggle_enforce_focus"
      commentLabel="Watch challenge to enforce focus"
      locked={locked}
      refreshSignal={refreshSignal}
    />
  );
}
