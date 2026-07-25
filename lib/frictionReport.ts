export type FrictionReport = {
  ts:       string;
  state:    { mode: string; streak: string; streakNote: string; injection: string; locked: boolean; scaling: string; deployment: string };
  exec:     { rating: number; label: "ELITE" | "ON-PAR" | "SUB-PAR"; leakage: number; forgiven: number; luckyR: number; capture: number; exemptions: number };
  edge:     { sqn: number; stressSqn: number; decay: number; decayLabel: string; risk: string };
  mirror:   string;
  flaws:    string[];
  handover: string;
  updates:  string[];
};

/* ═══════════════════════════════════════════════════════════
   ONEDRIVE REPORT PARSER
   ─ Parses the plain-text institutional audit format.
   ─ Feed the raw .txt content fetched from OneDrive here.
═══════════════════════════════════════════════════════════ */
export function parseFrictionReport(raw: string): FrictionReport {
  /* Pull a single * key : value line */
  const val = (key: string) =>
    raw.match(new RegExp(`\\*\\s*${key.replace(/[/()]/g, "\\$&")}\\s*:\\s*(.+)`))?.[1]?.trim() ?? "";

  /* ── Header ────────────────────────────────────────── */
  const ts        = raw.match(/TIMESTAMP:\s*(.+)/)?.[1]?.trim() ?? "";
  const stateMode = raw.match(/\[SYSTEM STATE\]\s*::\s*(.+)/)?.[1]?.trim() ?? "";
  const streakNote= raw.match(/\*\*(.+)/)?.[1]?.trim() ?? "";

  /* ── System State ──────────────────────────────────── */
  const injectRaw = val("Planned Injection\\/deposit");
  const injection = injectRaw.replace(/\s*\(.*\)/, "").trim();
  const locked    = /LOCKED/i.test(injectRaw);

  /* ── Execution Truth ───────────────────────────────── */
  const ratingRaw = val("Rating");
  const rating    = parseFloat(ratingRaw) || 0;
  const rawLabel  = ratingRaw.match(/\[([A-Z\-]+)\]/)?.[1] ?? "SUB-PAR";
  const label     = (["ELITE","ON-PAR","SUB-PAR"].includes(rawLabel) ? rawLabel : "SUB-PAR") as FrictionReport["exec"]["label"];
  const leakRaw   = val("Profit Leakage");
  const leakage   = parseFloat(leakRaw) || 0;
  const forgiven  = parseFloat(leakRaw.match(/ADJUSTED:\s*([\d.]+)/)?.[1] ?? "0") || 0;
  const luckyR    = parseFloat(val("Lucky R Total")) || 0;
  const capRaw    = val("Capture Rate");
  const capture   = parseFloat(capRaw) || 0;
  const exemptions= parseFloat(capRaw.match(/ADJUSTED:\s*([\d.]+)/)?.[1] ?? "0") || 0;

  /* ── Probabilistic Edge ────────────────────────────── */
  const sqn       = parseFloat(val("System SQN")) || 0;
  const stressSqn = parseFloat(val("95% Stress SQN")) || 0;
  const decayRaw  = val("Edge Decay");
  const decay     = parseFloat(decayRaw) || 0;
  const decayLabel= decayRaw.match(/\((.+)\)/)?.[1]?.trim() ?? "";
  const risk      = val("Target Risk");

  /* ── Mirror section ─────────────────────────────────── */
  const mirrorBlock = raw.split(/\[THE MIRROR.*?\]/i)[1]?.split(/\[SYSTEM FRICTION/i)[0] ?? "";
  /* Strip "Radical Candor:" prefix that sometimes appears after REVIEW: */
  const reviewRaw = mirrorBlock.match(/REVIEW:\s*([\s\S]+?)(?=\nDETECTED FLAWS|\nHANDOVER|$)/i)?.[1]?.trim() ?? "";
  const mirror    = reviewRaw.replace(/^Radical Candor:\s*/i, "").trim();
  const handover  = mirrorBlock.match(/HANDOVER NOTES:\s*([\s\S]+?)(?=\n={5,}|$)/i)?.[1]?.trim().replace(/",\s*$/, "") ?? "";

  /* Multi-line flaws — split on pipe-escaped newlines too */
  const flaws: string[] = [];
  for (const m of mirrorBlock.matchAll(/- \[([A-Z_]+)\]:\s*"([\s\S]+?)(?:"|$)/g)) {
    const text = m[2].split(/\|n/)[0].trim();
    flaws.push(`${m[1]}: ${text}`);
  }

  /* ── Friction updates ───────────────────────────────── */
  const updBlock  = raw.split(/\[SYSTEM FRICTION UPDATES\]/i)[1] ?? "";
  const updates   = [...updBlock.matchAll(/\*\s*(.+)/g)]
    .map(m => m[1].trim())
    .filter(Boolean);

  return {
    ts,
    state: {
      mode:       stateMode,
      streak:     val("Current Streak"),
      streakNote,
      injection,
      locked,
      scaling:    val("Scaling Factor").replace("x", "×"),
      deployment: val("Deployment"),
    },
    exec:  { rating, label, leakage, forgiven, luckyR, capture, exemptions },
    edge:  { sqn, stressSqn, decay, decayLabel, risk },
    mirror,
    flaws,
    handover,
    updates,
  };
}
