/**
 * IncidentLog — the founding "war story" (the one trade run without a
 * stop-loss) told as a mock incident report. Playful framing, professional
 * typesetting — mono labels, a severity chip, a redacted-style divider.
 */
export default function IncidentLog() {
  return (
    <div
      style={{
        position: "relative",
        background: "var(--sub)",
        border: "1px solid rgba(240,58,87,0.28)",
        borderRadius: 12,
        padding: "22px 24px",
        overflow: "hidden",
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
      }}
    >
      <div aria-hidden style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: "repeating-linear-gradient(90deg, #f03a57 0 10px, transparent 10px 20px)",
        opacity: 0.55,
      }} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <span className="mono" style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
          padding: "3px 9px", borderRadius: 5, color: "#f03a57",
          background: "rgba(240,58,87,0.12)", border: "1px solid rgba(240,58,87,0.35)",
        }}>
          INCIDENT LOG
        </span>
        <span className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.08em" }}>
          FILE 001 · UNPROTECTED POSITION · JUN 2020
        </span>
      </div>

      <p style={{ fontSize: 14, lineHeight: 1.85, color: "var(--ink-1)", marginBottom: 14 }}>
        Three hours, one open position, no stop-loss — the only time it ever happened.
        Floating profit ran to <strong style={{ color: "var(--ink-0)" }}>+150</strong> and
        was watched, un-managed, all the way back down to a close of{" "}
        <strong style={{ color: "var(--ink-0)" }}>+15</strong>. The lesson cost far more than
        the ten units left on the table.
      </p>

      <div style={{ height: 1, background: "rgba(240,58,87,0.18)", margin: "16px 0" }} />

      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span className="mono" style={{ fontSize: 9, fontWeight: 700, color: "var(--green)", letterSpacing: "0.1em", flexShrink: 0, marginTop: 1 }}>
          RESOLUTION
        </span>
        <p style={{ fontSize: 13, lineHeight: 1.75, color: "var(--ink-2)", margin: 0 }}>
          Every position placed since has carried a stop-loss from the moment it opened —
          zero exceptions, formalised years later as the first hard rule of the XTNL
          Scientific Sampling Methodology.
        </p>
      </div>
    </div>
  );
}
