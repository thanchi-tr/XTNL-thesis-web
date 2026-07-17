/**
 * KMS core — Zero-Trust Knowledge Management System primitives.
 *
 * Shared by client and server:
 *   • TAXONOMY — the Hierarchical Root-Cause Ontology (Domain → Sub-System → Leaf).
 *     The ONLY legal classification source. No free-text categorisation exists
 *     anywhere in the KMS; server routes validate against this exact tree.
 *   • KMS_STATUS — the survivability pipeline (never "closed", only contained).
 *   • triageScore — the Zero-Knowledge intercept scorer. Runs client-side against
 *     the already-loaded ledger, so the sub-100ms mandate holds deterministically
 *     (no network round-trip, no spinner).
 *   • OOS promotion rule — consecutive TRADING SESSIONS survived, not wall-clock
 *     hours. Containment is only tested under live market exposure; calendar time
 *     without sessions proves nothing. 15 sessions ≈ 3 full trading weeks, which
 *     matches the fund's established 3-week observation cadence.
 */

/* ── Hierarchical Root-Cause Ontology ─────────────────────────────────────── */

export interface TaxonomyLeaf   { id: string; label: string }
export interface TaxonomySub    { id: string; label: string; leaves: TaxonomyLeaf[] }
export interface TaxonomyDomain { id: string; label: string; hint: string; subs: TaxonomySub[] }

export const TAXONOMY: TaxonomyDomain[] = [
  {
    id: "biological", label: "Biological Substrate", hint: "Cognitive · Emotional",
    subs: [
      { id: "cognitive_drift", label: "Dopamine Relapse", leaves: [
        { id: "context_switch_gaming",  label: "Context-switch — gaming" },
        { id: "social_media_drift",     label: "Social / media drift" },
        { id: "session_abandonment",    label: "Session abandonment" },
      ]},
      { id: "visual_fatigue", label: "Visual Fatigue", leaves: [
        { id: "spatial_misread",        label: "Spatial misread" },
        { id: "chart_hallucination",    label: "Chart hallucination" },
      ]},
      { id: "emotional_override", label: "Emotional Override", leaves: [
        { id: "fomo_entry",             label: "FOMO entry" },
        { id: "revenge_trading",        label: "Revenge trading" },
        { id: "checklist_violation",    label: "Checklist violation" },
      ]},
    ],
  },
  {
    id: "hardware", label: "Hardware & Telemetry", hint: "Network · Power",
    subs: [
      { id: "wear_os_edge", label: "Wear OS Edge Node", leaves: [
        { id: "haptic_broadcast_failure",  label: "Haptic broadcast failure" },
        { id: "background_polling_drain",  label: "Background polling drain" },
        { id: "token_pairing_loss",        label: "Token / pairing loss" },
      ]},
      { id: "network", label: "Network Layer", leaves: [
        { id: "broker_api_latency",     label: "Broker API latency" },
        { id: "websocket_disconnect",   label: "WebSocket disconnect" },
        { id: "dns_resolution_failure", label: "DNS resolution failure" },
      ]},
      { id: "power_compute", label: "Power & Compute", leaves: [
        { id: "device_thermal_throttle", label: "Device thermal throttle" },
        { id: "power_interruption",      label: "Power interruption" },
      ]},
    ],
  },
  {
    id: "execution", label: "Execution Firmware", hint: "Spatial Geometry · Sizing",
    subs: [
      { id: "spatial_geometry", label: "Spatial Geometry", leaves: [
        { id: "anchor_misplacement",     label: "Anchor misplacement" },
        { id: "stop_variance_drift",     label: "Stop-loss variance drift" },
        { id: "target_projection_error", label: "Target projection error" },
      ]},
      { id: "sizing_risk", label: "Sizing & Risk", leaves: [
        { id: "position_size_mismatch",  label: "Position size mismatch" },
        { id: "r_allocation_breach",     label: "R allocation breach" },
      ]},
      { id: "pipeline_data", label: "Pipeline & Data", leaves: [
        { id: "ingestion_failure",   label: "Ingestion failure" },
        { id: "report_staleness",    label: "Report staleness" },
        { id: "metric_divergence",   label: "Metric divergence" },
      ]},
    ],
  },
];

/** Server-side lockout: true only for an exact Domain→Sub→Leaf path in the tree. */
export function isValidTaxonomyPath(domain: string, subsystem: string, leaf: string): boolean {
  const d = TAXONOMY.find(x => x.id === domain);
  const s = d?.subs.find(x => x.id === subsystem);
  return !!s?.leaves.find(x => x.id === leaf);
}

export function taxonomyLabels(domain?: string | null, subsystem?: string | null, leaf?: string | null) {
  const d = TAXONOMY.find(x => x.id === domain);
  const s = d?.subs.find(x => x.id === subsystem);
  const l = s?.leaves.find(x => x.id === leaf);
  return { domain: d?.label ?? null, subsystem: s?.label ?? null, leaf: l?.label ?? null };
}

/* ── Survivability pipeline ───────────────────────────────────────────────── */

export type KmsStatus =
  | "TRIAGE_PENDING" | "TOOL_QUEUED" | "OOS_VALIDATION" | "BASELINE_RESTORED" | "RELAPSED";

export const KMS_STATUS_META: Record<KmsStatus, { label: string; color: string; bg: string; desc: string }> = {
  TRIAGE_PENDING:    { label: "TRIAGE PENDING",    color: "#f0a030", bg: "rgba(240,160,48,0.12)",  desc: "Novel — awaiting Strategist analysis" },
  TOOL_QUEUED:       { label: "TOOL QUEUED",       color: "#4d9cf5", bg: "rgba(77,156,245,0.12)",  desc: "Mitigation asset selected, deployment pending" },
  OOS_VALIDATION:    { label: "OOS VALIDATION",    color: "#00b4ff", bg: "rgba(0,180,255,0.10)",   desc: "Tool live — surviving out-of-sample" },
  BASELINE_RESTORED: { label: "BASELINE RESTORED", color: "#00cc7a", bg: "rgba(0,204,122,0.12)",   desc: "Contained — pending permanent vigilance" },
  RELAPSED:          { label: "RELAPSED",          color: "#f03a57", bg: "rgba(240,58,87,0.12)",   desc: "Containment breached — active threat" },
};

/** Legacy → pipeline mapping for rows the migration has not touched. */
export function toKmsStatus(kms: string | null | undefined, legacy: string): KmsStatus {
  if (kms && kms in KMS_STATUS_META) return kms as KmsStatus;
  switch (legacy) {
    case "in_progress": return "TOOL_QUEUED";
    case "staging":     return "OOS_VALIDATION";
    case "archived":    return "BASELINE_RESTORED";
    default:            return "TRIAGE_PENDING";
  }
}

/* ── OOS auto-promotion rule ──────────────────────────────────────────────────
 * Parameter: CONSECUTIVE TRADING SESSIONS SURVIVED (not hours elapsed).
 * A session-day = a Mon–Fri calendar day in Melbourne time — the deterministic
 * proxy for one live execution session under the fund's schedule. Promotion is
 * automatic at ≥ OOS_SESSIONS_REQUIRED session-days since oos_started_at with
 * zero relapse events in the window. Any relapse resets the clock to zero.   */
export const OOS_SESSIONS_REQUIRED = 15;

const MEL_DAY_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Australia/Melbourne", weekday: "short",
});

/** Count Mon–Fri days (Melbourne) fully elapsed between `fromIso` and now. */
export function tradingSessionsSince(fromIso: string, now: Date = new Date()): number {
  const from = new Date(fromIso);
  if (isNaN(from.getTime()) || from >= now) return 0;
  let count = 0;
  const cursor = new Date(from);
  cursor.setUTCHours(cursor.getUTCHours() + 24);          // first full day boundary
  while (cursor <= now) {
    const wd = MEL_DAY_FMT.format(cursor);
    if (wd !== "Sat" && wd !== "Sun") count++;
    cursor.setUTCHours(cursor.getUTCHours() + 24);
  }
  return count;
}

/* ── Zero-Knowledge triage scorer ─────────────────────────────────────────────
 * Tokenised similarity against the loaded ledger. Title tokens weigh 3×,
 * description 1×, plus strong bonuses for matching taxonomy nodes. Pure
 * function over in-memory data → executes in far under 100 ms.             */

const STOP = new Set(["the","a","an","is","are","was","were","to","of","in","on","at","and","or","it","its","my","when","with","for","not","no","this","that","i"]);

function tokens(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2 && !STOP.has(t));
}

export interface TriageCandidate {
  issue_id: string;
  title: string;
  description: string | null;
  domain: string | null;
  subsystem: string | null;
  leaf_node: string | null;
}

export interface TriageMatch { issue_id: string; score: number }

export function triageScore(
  draft: { title: string; description: string; domain: string; subsystem: string; leaf: string },
  ledger: TriageCandidate[],
): TriageMatch[] {
  const dTitle = new Set(tokens(draft.title));
  const dDesc  = new Set(tokens(draft.description));
  const out: TriageMatch[] = [];

  for (const c of ledger) {
    const cTitle = tokens(c.title);
    const cDesc  = tokens(c.description ?? "");
    let score = 0;
    for (const t of cTitle) { if (dTitle.has(t)) score += 3; else if (dDesc.has(t)) score += 1.5; }
    for (const t of cDesc)  { if (dTitle.has(t)) score += 1.5; else if (dDesc.has(t)) score += 0.5; }
    if (c.leaf_node && c.leaf_node === draft.leaf)          score += 6;
    else if (c.subsystem && c.subsystem === draft.subsystem) score += 3;
    else if (c.domain && c.domain === draft.domain)          score += 1;
    if (score > 0) out.push({ issue_id: c.issue_id, score });
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}

/** Normalised 0–100 similarity for UI display. */
export function similarityPct(score: number): number {
  return Math.min(99.9, Math.round((1 - Math.exp(-score / 9)) * 1000) / 10);
}

/** Threshold above which the intercept forces the historical-match fork. */
export const TRIAGE_MATCH_THRESHOLD = 6;
