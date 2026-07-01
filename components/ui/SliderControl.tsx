"use client";

import { useState, useEffect, useCallback } from "react";

interface SliderControlProps {
  label:        string;
  value:        number;
  displayValue: string;
  min:          number;
  max:          number;
  step:         number;
  tooltip:      string;
  onChange:     (v: number) => void;
  readOnly?:    boolean;
}

export default function SliderControl({
  label, value, displayValue, min, max, step, tooltip, onChange, readOnly = false,
}: SliderControlProps) {
  /*
   * Local value drives the slider's *position* immediately —
   * no round-trip through the parent's state / debounce.
   * The parent's `value` prop is the source of truth after
   * a simulation completes or a preset is applied; we sync it in.
   */
  const [local, setLocal] = useState(value);

  /* Sync from parent only when it changes externally (e.g., presets) */
  useEffect(() => { setLocal(value); }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value);
      setLocal(v);    // instant — no parent re-render path
      onChange(v);    // debounced simulation in parent
    },
    [onChange]
  );

  const pct = ((local - min) / (max - min)) * 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, opacity: readOnly ? 0.6 : 1 }}>
      {/* Label row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="label-xs">{label}</span>
          {readOnly ? (
            <svg width="9" height="9" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
              <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M4.5 6V4a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          ) : (
            <span
              title={tooltip}
              style={{
                width: 13, height: 13, borderRadius: "50%",
                background: "var(--line-hi)", color: "var(--ink-2)",
                fontSize: 8, fontWeight: 700,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                cursor: "help", flexShrink: 0,
              }}
            >?</span>
          )}
        </div>
        <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: readOnly ? "rgba(0,204,122,0.5)" : "var(--green)" }}>
          {displayValue}
        </span>
      </div>

      <div style={{ position: "relative", height: 20, display: "flex", alignItems: "center" }}>
        <div
          style={{
            position: "absolute", left: 0, width: `${pct}%`, height: 3,
            background: readOnly ? "rgba(0,204,122,0.3)" : "var(--green)",
            borderRadius: 2, opacity: 0.55, pointerEvents: "none", willChange: "width",
          }}
        />
        <input
          type="range"
          min={min} max={max} step={step} value={local}
          onChange={readOnly ? undefined : handleChange}
          disabled={readOnly}
          style={{ position: "relative", zIndex: 1, margin: 0, cursor: readOnly ? "not-allowed" : undefined }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span className="mono" style={{ fontSize: 8, color: "var(--ink-3)" }}>{min}</span>
        <span className="mono" style={{ fontSize: 8, color: "var(--ink-3)" }}>{max}</span>
      </div>
    </div>
  );
}
