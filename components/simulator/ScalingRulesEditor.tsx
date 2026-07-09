"use client";

import { useState } from "react";
import type { ScalingCondition } from "@/lib/simulation";

interface Props {
  conditions: ScalingCondition[];
  onChange:   (conditions: ScalingCondition[]) => void;
  readOnly?:  boolean;
}

type DraftCondition = Omit<ScalingCondition, "id">;

const METRIC_LABELS: Record<ScalingCondition["metric"], string> = {
  efficiency:  "Efficiency",
  captureRate: "Capture Rate",
};

const OP_LABELS: Record<ScalingCondition["op"], string> = {
  "<":  "<",
  "<=": "≤",
  ">":  ">",
  ">=": "≥",
};

const DEFAULT_DRAFT: DraftCondition = {
  metric:      "efficiency",
  op:          "<",
  threshold:   0.60,
  rMultiplier: 0.50,
};

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const S = {
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "5px 8px",
    background: "rgba(0,0,0,0.22)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 5,
    marginBottom: 4,
  } as React.CSSProperties,
  conditionBadge: (color: string) => ({
    fontSize: 9,
    fontFamily: "var(--font-mono)",
    fontWeight: 700,
    color,
    letterSpacing: "0.05em",
  }) as React.CSSProperties,
  select: {
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 4,
    color: "var(--ink-1)",
    fontSize: 10,
    fontFamily: "var(--font-mono)",
    padding: "3px 5px",
    outline: "none",
  } as React.CSSProperties,
  input: {
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 4,
    color: "var(--ink-0)",
    fontSize: 10,
    fontFamily: "var(--font-mono)",
    padding: "3px 6px",
    outline: "none",
    width: 54,
    textAlign: "right" as const,
  } as React.CSSProperties,
  deleteBtn: {
    background: "none",
    border: "none",
    color: "rgba(240,58,87,0.5)",
    cursor: "pointer",
    fontSize: 12,
    lineHeight: 1,
    padding: "0 2px",
    marginLeft: "auto",
    flexShrink: 0,
  } as React.CSSProperties,
};

export default function ScalingRulesEditor({ conditions, onChange, readOnly }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft,  setDraft]  = useState<DraftCondition>(DEFAULT_DRAFT);

  const remove = (id: string) =>
    onChange(conditions.filter((c) => c.id !== id));

  const commit = () => {
    if (!draft.rMultiplier || !draft.threshold) return;
    onChange([...conditions, { id: makeId(), ...draft }]);
    setDraft(DEFAULT_DRAFT);
    setAdding(false);
  };

  const metricColor = (m: ScalingCondition["metric"]) =>
    m === "efficiency" ? "#00cc7a" : "#4d9cf5";

  return (
    <div style={{ marginTop: 6 }}>

      {/* Existing rules */}
      {conditions.length === 0 && !adding && (
        <div style={{ fontSize: 10, color: "rgba(142,163,190,0.35)", padding: "6px 4px" }}>
          No scaling rules — applied risk = standard formula
        </div>
      )}

      {conditions.map((cond) => (
        <div key={cond.id} style={S.row}>
          <span style={S.conditionBadge(metricColor(cond.metric))}>
            {METRIC_LABELS[cond.metric]}
          </span>
          <span style={{ fontSize: 11, color: "rgba(142,163,190,0.7)", fontFamily: "var(--font-mono)" }}>
            {OP_LABELS[cond.op]}
          </span>
          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--ink-1)", fontWeight: 600 }}>
            {(cond.threshold * 100).toFixed(0)}%
          </span>
          <span style={{ fontSize: 9, color: "rgba(142,163,190,0.4)" }}>→ R ×</span>
          <span style={{
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            color: cond.rMultiplier >= 1 ? "#00cc7a" : "#f0a030",
          }}>
            {cond.rMultiplier.toFixed(2)}
          </span>
          {!readOnly && (
            <button style={S.deleteBtn} onClick={() => remove(cond.id)} title="Remove rule">
              ✕
            </button>
          )}
        </div>
      ))}

      {/* Add rule form */}
      {adding ? (
        <div style={{
          padding: "10px",
          background: "rgba(0,204,122,0.04)",
          border: "1px solid rgba(0,204,122,0.12)",
          borderRadius: 6,
          marginTop: 4,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{ fontSize: 9, color: "rgba(142,163,190,0.55)" }}>IF</span>
            <select
              style={S.select}
              value={draft.metric}
              onChange={(e) => setDraft({ ...draft, metric: e.target.value as ScalingCondition["metric"] })}
            >
              <option value="efficiency">Efficiency</option>
              <option value="captureRate">Capture Rate</option>
            </select>
            <select
              style={S.select}
              value={draft.op}
              onChange={(e) => setDraft({ ...draft, op: e.target.value as ScalingCondition["op"] })}
            >
              <option value="<">{`< (less than)`}</option>
              <option value="<=">{`≤ (at most)`}</option>
              <option value=">">{`> (greater than)`}</option>
              <option value=">=">{`≥ (at least)`}</option>
            </select>
            <input
              type="number"
              style={S.input}
              value={Math.round(draft.threshold * 100)}
              min={1} max={200} step={1}
              onChange={(e) => setDraft({ ...draft, threshold: Number(e.target.value) / 100 })}
            />
            <span style={{ fontSize: 9, color: "rgba(142,163,190,0.55)" }}>%</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
            <span style={{ fontSize: 9, color: "rgba(142,163,190,0.55)" }}>THEN R ×</span>
            <input
              type="number"
              style={{ ...S.input, width: 64 }}
              value={draft.rMultiplier}
              min={0.01} max={5.0} step={0.05}
              onChange={(e) => setDraft({ ...draft, rMultiplier: Number(e.target.value) })}
            />
            <span style={{ fontSize: 9, color: "rgba(142,163,190,0.35)" }}>
              (e.g. 0.50 = 50% risk, 1.30 = 130% risk)
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={commit}
              style={{
                fontSize: 10, padding: "5px 12px", borderRadius: 4, border: "none",
                background: "rgba(0,204,122,0.18)", color: "#00cc7a",
                cursor: "pointer", fontFamily: "var(--font-mono)", fontWeight: 700,
              }}
            >
              Add Rule
            </button>
            <button
              onClick={() => { setAdding(false); setDraft(DEFAULT_DRAFT); }}
              style={{
                fontSize: 10, padding: "5px 10px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.08)",
                background: "none", color: "rgba(142,163,190,0.6)",
                cursor: "pointer", fontFamily: "var(--font-mono)",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        !readOnly && (
          <button
            onClick={() => setAdding(true)}
            style={{
              marginTop: 4,
              fontSize: 10, padding: "5px 10px",
              borderRadius: 4,
              border: "1px dashed rgba(0,204,122,0.20)",
              background: "none",
              color: "rgba(0,204,122,0.6)",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              width: "100%",
              textAlign: "center",
            }}
          >
            + Add Scaling Rule
          </button>
        )
      )}
    </div>
  );
}
