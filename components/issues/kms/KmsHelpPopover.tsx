"use client";

/**
 * KmsHelpPopover — the "?" reference card inside the expanded issue popup.
 * Explains the taxonomy path, the survivability pipeline, priority weights,
 * and what every action button in the Record/Resolve sections actually does.
 * Toggled inline (no modal) so it doesn't fight the panel's own scroll.
 */

import { useState } from "react";
import { KMS_STATUS_META } from "@/lib/kms";

const ROW: React.CSSProperties = { display: "flex", gap: 8, alignItems: "flex-start", padding: "3px 0" };
const KEY: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 700, flexShrink: 0, width: 92 };
const VAL: React.CSSProperties = { fontSize: 11, color: "var(--ink-1,#9ab0c8)", lineHeight: 1.5 };

export default function KmsHelpPopover() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Explain this panel"
        aria-label="Explain this panel"
        style={{
          width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
          border: `1px solid ${open ? "rgba(0,204,122,0.6)" : "var(--line-hi,rgba(255,255,255,0.11))"}`,
          background: open ? "rgba(0,204,122,0.15)" : "var(--raised,#0f1e2e)",
          color: open ? "#00cc7a" : "var(--ink-2,#5a7490)",
          fontSize: 10, fontWeight: 700, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          lineHeight: 1, padding: 0,
        }}
      >
        ?
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: 22, right: 0, zIndex: 20,
            width: 296, maxHeight: 360, overflowY: "auto",
            padding: "12px 13px", borderRadius: 8,
            background: "var(--card,#0b1622)", border: "1px solid rgba(0,204,122,0.28)",
            boxShadow: "0 12px 36px rgba(0,0,0,0.6)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-0,#eef2f8)" }}>How to read this panel</span>
            <button onClick={() => setOpen(false)} aria-label="Close"
              style={{ background: "none", border: "none", color: "var(--ink-2,#5a7490)", fontSize: 14, cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>

          <Section title="TAXONOMY PATH">
            Domain <span style={{ color: "var(--ink-2,#5a7490)" }}>→</span> Sub-System <span style={{ color: "var(--ink-2,#5a7490)" }}>→</span> Leaf Node
            is the exact root-cause classification. It's locked at report time — no free-text tags exist anywhere in the KMS.
          </Section>

          <Section title="PIPELINE STATE">
            {(Object.keys(KMS_STATUS_META) as (keyof typeof KMS_STATUS_META)[]).map(k => {
              const meta = KMS_STATUS_META[k];
              return (
                <div key={k} style={ROW}>
                  <span className="mono" style={{ ...KEY, color: meta.color }}>{meta.label}</span>
                  <span style={VAL}>{meta.desc}</span>
                </div>
              );
            })}
          </Section>

          <Section title="PRIORITY">
            <div style={VAL}>
              DIRE / CRITICAL rank highest and pulse red — treat as immediate. INFO is the lowest weight in the Systemic Entropy Score.
            </div>
          </Section>

          <Section title="RECORD ACTIONS">
            <div style={ROW}><span style={KEY}>↑ Raise</span><span style={VAL}>Log another occurrence of the same anomaly — increases its priority weight, not a duplicate row.</span></div>
            <div style={ROW}><span style={KEY}>+ Sub-issue</span><span style={VAL}>Link a related anomaly as a child of this one.</span></div>
          </Section>

          <Section title="RESOLVE ACTIONS">
            <div style={ROW}><span style={KEY}>Propose Solution</span><span style={VAL}>Free-text mitigation note (legacy). Prefer deploying a Digital Tool from the Tools tab for anything trackable.</span></div>
            <div style={ROW}><span style={KEY}>Scratch</span><span style={VAL}>Permanently discards the current solution text; it's kept in scratched history.</span></div>
            <div style={ROW}><span style={KEY}>Observed wk</span><span style={VAL}>Strategist confirms a week passed with no relapse. Weeks unlock in order.</span></div>
            <div style={ROW}><span style={KEY}>Close Issue</span><span style={VAL}>Manual archive, bypassing OOS validation — use sparingly.</span></div>
            <div style={ROW}><span style={KEY}>⚑ Reopen</span><span style={VAL}>Confirms a relapse: reverts to an active threat, increments the append-only reopen counter, and degrades the deployed tool's OOS survival score.</span></div>
            <div style={ROW}><span style={KEY}>✓ / ✗</span><span style={VAL}>Endorse or disregard the active solution (operator feedback, one vote each).</span></div>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="mono" style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", color: "var(--ink-2,#5a7490)", marginBottom: 4 }}>
        {title}
      </div>
      {children}
    </div>
  );
}
