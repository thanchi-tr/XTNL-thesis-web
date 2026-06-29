"use client";

import { useState, useEffect, useCallback } from "react";

interface SliderControlProps {
  label:        string;
  value:        number;   // canonical value from parent (for preset sync)
  displayValue: string;   // formatted string for the label (from parent)
  min:          number;
  max:          number;
  step:         number;
  tooltip:      string;
  onChange:     (v: number) => void;
}

export default function SliderControl({
  label, value, displayValue, min, max, step, tooltip, onChange,
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
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {/* Label row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="label-xs">{label}</span>
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
        </div>
        {/* Display value from parent — shows formatted result; updates after debounce */}
        <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--green)" }}>
          {displayValue}
        </span>
      </div>

      {/* Track wrapper — filled portion is purely visual via CSS, no re-layout */}
      <div
        style={{
          position: "relative",
          height: 20,
          display: "flex",
          alignItems: "center",
        }}
      >
        {/* Filled track (CSS only, pointer-events: none) */}
        <div
          style={{
            position: "absolute",
            left: 0,
            width: `${pct}%`,
            height: 3,
            background: "var(--green)",
            borderRadius: 2,
            opacity: 0.55,
            pointerEvents: "none",
            willChange: "width",     /* hint browser to composite this layer */
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={local}
          onChange={handleChange}
          style={{ position: "relative", zIndex: 1, margin: 0 }}
        />
      </div>

      {/* Min / max hints */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span className="mono" style={{ fontSize: 8, color: "var(--ink-3)" }}>{min}</span>
        <span className="mono" style={{ fontSize: 8, color: "var(--ink-3)" }}>{max}</span>
      </div>
    </div>
  );
}
