/**
 * Actionable Runbooks — hardcoded diagnostic steps keyed to the exact
 * Domain → Sub-System → Leaf ontology in lib/kms.ts (TAXONOMY). No database
 * table, no CMS — the whole point is that the correct procedure appears the
 * instant a leaf node is selected, with zero searching, because searching is
 * exactly what an operator under load doesn't have the spare capacity for.
 *
 * Coverage is 1:1 with TAXONOMY's leaves. If a leaf is added there, add its
 * runbook here — the UI falls back to "no runbook written yet" rather than
 * silently showing nothing, so a gap is obvious in review.
 */

export interface Runbook {
  title: string;
  steps: string[];
}

export const RUNBOOKS: Record<string, Runbook> = {
  /* ── Biological Substrate ─────────────────────────────────────────── */
  context_switch_gaming: {
    title: "Context-switch — gaming",
    steps: [
      "Close the game/app immediately — do not finish the round first.",
      "Log the exact time the switch happened against the session's active window.",
      "Check whether any trade decision was made in the last 5 minutes; if so, review it once fully re-focused.",
      "If this is a repeat this week, tighten the trading-session toggle window rather than relying on willpower.",
    ],
  },
  social_media_drift: {
    title: "Social / media drift",
    steps: [
      "Close the tab/app — don't wait for a natural stopping point.",
      "Check the last acknowledged focus-window timestamp; if it's overdue, expect a fail-streak entry.",
      "Note what triggered the drift (notification, boredom, habit) in the issue description — it's the pattern that matters, not the incident.",
    ],
  },
  session_abandonment: {
    title: "Session abandonment",
    steps: [
      "Confirm whether any position is still open — if so, that takes priority over logging this.",
      "Stop the alarm (don't leave it running unattended) rather than letting focus windows silently fail.",
      "Record the reason and duration away — this determines whether the week's data needs a corrective rerun.",
    ],
  },
  spatial_misread: {
    title: "Spatial misread",
    steps: [
      "Re-check the chart at the actual timeframe used for entry, not a cached/zoomed view.",
      "Compare the anchor/stop/target you recorded against what's actually on the chart right now.",
      "If the misread already produced a live entry, flag it under Execution Firmware → Spatial Geometry as the technical consequence, and this issue as the biological cause.",
    ],
  },
  chart_hallucination: {
    title: "Chart hallucination",
    steps: [
      "Step away from the screen for at least 60 seconds before re-evaluating — this is a fatigue symptom, not a chart problem.",
      "Re-open the chart fresh rather than trusting the mental image you were working from.",
      "If this happens more than once in a session, treat it as a visual-fatigue signal, not an isolated event.",
    ],
  },
  fomo_entry: {
    title: "FOMO entry",
    steps: [
      "If the entry hasn't been placed yet, don't place it — the checklist exists precisely for this moment.",
      "If it's already placed, manage it exactly per the existing risk rules — don't compound the error by moving the stop.",
      "Log the setup that triggered it so the pattern is visible in the weekly review, not just the single incident.",
    ],
  },
  revenge_trading: {
    title: "Revenge trading",
    steps: [
      "Stop entering new trades immediately — this is the one category where the correct action is always to do nothing next.",
      "Step away from the platform for the remainder of the current focus interval at minimum.",
      "Document the losing trade that preceded this — revenge trading is always a reaction, never a standalone plan.",
    ],
  },
  checklist_violation: {
    title: "Checklist violation",
    steps: [
      "Identify exactly which checklist item was skipped — vague entries make this unreviewable later.",
      "If the trade is still open, do not add to it until the missed check has been completed retroactively.",
      "Raise this if it recurs — a single miss is a slip, a repeat is a rule gap worth fixing in the checklist itself.",
    ],
  },

  /* ── Hardware & Telemetry ─────────────────────────────────────────── */
  haptic_broadcast_failure: {
    title: "Haptic broadcast failure",
    steps: [
      "Confirm the watch app is in the foreground — background haptics are unreliable on most Wear OS builds.",
      "Re-pair via the watch_device_codes flow if the last successful ping was more than one cycle ago.",
      "If pairing is fine but haptics still don't fire, fall back to the in-browser sound alarm for this session and note the device/OS version.",
    ],
  },
  background_polling_drain: {
    title: "Background polling drain",
    steps: [
      "Check battery drain against a normal session — GlobalAlarmNotifier's 20s poll should not be the dominant drain.",
      "Confirm only one tab/device has 'xtnl_alarm_tab' ownership — duplicate polling from multiple open tabs compounds drain.",
      "If drain is still excessive, note the device model — this may be a platform-specific background-throttling issue, not an app bug.",
    ],
  },
  token_pairing_loss: {
    title: "Token / pairing loss",
    steps: [
      "Re-generate a pairing code from the session page and re-pair the watch device.",
      "Confirm the watch's clock hasn't drifted — token validation is time-sensitive.",
      "If pairing repeatedly drops mid-session, capture the approximate time-to-drop; this is diagnostic for a token-refresh bug, not user error.",
    ],
  },
  broker_api_latency: {
    title: "Broker API latency",
    steps: [
      "Check whether the delay is isolated to StoneX or affects all outbound calls (Graph API, Supabase) — isolates broker-side vs. local network.",
      "Do not resize or re-enter a position based on a stale quote — wait for confirmation before acting on latent data.",
      "If latency persists past one session, this is a Tier 3 Pipeline & Data concern, not just a hardware blip — cross-reference report_staleness.",
    ],
  },
  websocket_disconnect: {
    title: "WebSocket disconnect",
    steps: [
      "Refresh the page — most disconnects self-resolve on reconnect without data loss (state is server-persisted, not client-only).",
      "If disconnects are recurring within the same session, check for a flaky network rather than restarting repeatedly.",
      "Confirm the alarm/challenge state after reconnect matches what you expect — a missed reconnect window can silently cost a focus-window ack.",
    ],
  },
  dns_resolution_failure: {
    title: "DNS resolution failure",
    steps: [
      "Confirm it's DNS and not a genuine outage — try a known-good domain from the same network.",
      "Switch network (mobile hotspot) if available rather than waiting on a DNS cache to clear.",
      "If this happens at the same time of day repeatedly, it may be an ISP/ WiFi issue, not this app — note the pattern.",
    ],
  },
  device_thermal_throttle: {
    title: "Device thermal throttle",
    steps: [
      "Close other heavy background apps/tabs — throttling degrades UI responsiveness right when precision matters most.",
      "Move off battery-saver/low-power mode for the remainder of the active trading window.",
      "If throttling is a recurring pattern on this device, consider it unfit for live execution and switch devices for future sessions.",
    ],
  },
  power_interruption: {
    title: "Power interruption",
    steps: [
      "Confirm any open position wasn't left unmanaged during the outage — check the broker directly, not just this app's cached state.",
      "Once power/connectivity is restored, refresh and reconcile the session state before resuming.",
      "Log the outage duration — it's relevant context for why a focus window may have been missed.",
    ],
  },

  /* ── Execution Firmware ───────────────────────────────────────────── */
  anchor_misplacement: {
    title: "Anchor misplacement",
    steps: [
      "Re-derive the anchor from the actual structure on the chart — don't trust a value carried over from a prior setup.",
      "Cross-check against the recorded entry in the Optimal table for this trade, if already logged.",
      "If the anchor was live and wrong, correct the recorded trade data immediately so downstream metrics (SQN, expectancy) aren't polluted by a bad data point.",
    ],
  },
  stop_variance_drift: {
    title: "Stop-loss variance drift",
    steps: [
      "Compare the actual placed stop against the system-recommended stop for this setup — quantify the variance in R, not just pips.",
      "If the variance breaches the 1.5R MasterGatekeeper loss limit, expect this trade to be flagged in the next quarantine review.",
      "Check whether variance is a one-off execution error or a systematic bias (always wider, always tighter) — the latter needs a rule fix, not a one-time correction.",
    ],
  },
  target_projection_error: {
    title: "Target projection error",
    steps: [
      "Recompute the target using the same method as the system's recommended R, not a rounded/eyeballed figure.",
      "If the trade is still open, do not move the target based on the corrected projection — manage it per plan; log the error for review instead.",
      "Note whether this error type recurs across sessions — a consistent projection bias is worth encoding into the checklist.",
    ],
  },
  position_size_mismatch: {
    title: "Position size mismatch",
    steps: [
      "Compare the actual position size against the firmware's SYSTEM_TARGET_PCT for this account state — pull the current recommend_r, don't estimate.",
      "If oversized, reduce immediately regardless of current P&L — sizing errors compound risk independently of the trade's own merit.",
      "Check whether the firmware (XTNLS_Firmware.pinescript) is stale — a debug run should never have overwritten it (see the PIPELINE_MODE fix), but confirm the copied firmware matches the latest live pull.",
    ],
  },
  r_allocation_breach: {
    title: "R allocation breach",
    steps: [
      "Confirm the breach against the actual R the trade was risking, not the intended R — these can diverge from a sizing error.",
      "If cumulative weekly R risked is approaching the account's fractional-Kelly ceiling, halt new entries for the remainder of the week.",
      "Log this against Sizing & Risk even if the individual trade result was positive — the breach is about process, not outcome.",
    ],
  },
  ingestion_failure: {
    title: "Ingestion failure",
    steps: [
      "Check CloudWatch logs for xtnl-run-ingest — a real error there (auth, StoneX API, DB write) is the actual cause, not a symptom to guess at.",
      "Re-trigger ingestion via the pipeline banner's Ingestion step once the underlying cause is identified — it's safe to re-run.",
      "If ingestion succeeded but data still looks wrong downstream, check whether the weekly pipeline ran afterward — ingestion alone doesn't recompute metrics.",
    ],
  },
  report_staleness: {
    title: "Report staleness",
    steps: [
      "Check the report's reportDate/weekKey against the current trading week — a mismatch means the cache genuinely needs refreshing, not a bug.",
      "Trigger the on-demand refresh (analyst POST to /api/data/report) rather than waiting for a natural cache expiry — this report is cached per-week by design.",
      "If refreshing doesn't update the content, confirm the pipeline actually completed a live run this week (not just a debug preview) — a debug run correctly never touches live.general.txt.",
    ],
  },
  metric_divergence: {
    title: "Metric divergence",
    steps: [
      "Identify which specific metric diverged (SQN, expectancy, capture rate) and against which sample — divergence in one subsystem view vs. another is often expected, not a bug.",
      "Cross-check the raw trade count for that sample — a small n can produce large-looking metric swings that are statistically noise, not drift.",
      "If divergence is large and sample size is adequate, treat it as a genuine Tier 3 signal — this is exactly what WFO walk-forward validation exists to catch.",
    ],
  },

  /* ── Trust Governance ─────────────────────────────────────────────── */
  weekly_drawdown_floor_breach: {
    title: "Weekly drawdown floor breach",
    steps: [
      "Stop entering new trades for the remainder of the week — this is a capital-preservation floor, not a normal risk event.",
      "Pull the current streak/cumulate_fund state from system_memory_ledger for this week_id to confirm the breach against the actual persisted figures, not a mental estimate.",
      "This is always SEV1 — log it as such regardless of how the week otherwise looks; a floor breach doesn't get averaged out by a good week.",
    ],
  },
  cumulative_r_ceiling_approach: {
    title: "Cumulative R ceiling approach",
    steps: [
      "Sum realised + open R for the week against the fractional-Kelly ceiling — use the actual weekly ledger figure, not the current session's view alone.",
      "If within 0.2R of the ceiling, treat any new entry as a ceiling breach in waiting — reduce size or stop rather than wait for the hard stop to fire.",
      "Log whether this was reached via a single outsized trade or accumulation across many small ones — the remediation differs (a sizing fix vs. a frequency fix).",
    ],
  },
  fund_size_drift_unverified: {
    title: "Fund size drift unverified",
    steps: [
      "Compare the account state used by the firmware's account_backup/fixed_aud_risk calculation against the broker's actual current balance.",
      "Do not let a new firmware generation run against an unverified fund size — a stale or wrong balance directly miscalculates position sizing for every future trade.",
      "Once verified, confirm the correction actually reaches the next firmware pull (not a debug run — see the PIPELINE_MODE gating) before resuming live sizing decisions.",
    ],
  },
  unauthorized_firmware_mutation: {
    title: "Unauthorized firmware mutation",
    steps: [
      "Compare the currently-installed PineScript on the platform against the last known-good XTNLS_Firmware.pinescript pulled from OneDrive.",
      "If they differ outside of a normal live pipeline run, treat the installed copy as untrusted — do not trade against it until reconciled.",
      "Re-pull firmware via Copy Firmware and reinstall from that verified source rather than hand-editing the platform copy back into shape.",
    ],
  },
  off_window_deploy: {
    title: "Off-window deploy",
    steps: [
      "Confirm whether the deploy was a genuine live pipeline run or a debug preview that incorrectly touched a live destination — check the file's actual OneDrive modified timestamp against the trigger_source in ingestion_jobs.",
      "If it was a real off-window live deploy, treat every trade taken against that firmware version as provisionally suspect until the sizing inputs are re-verified.",
      "This is exactly the class of bug the PIPELINE_MODE / event-payload fixes exist to prevent — if it recurs after those fixes are deployed, that's a regression worth escalating immediately, not re-patching ad hoc.",
    ],
  },
  untested_config_push: {
    title: "Untested config push",
    steps: [
      "Identify the specific config.yaml or template.yaml change and whether it went through a debug preview run before being applied live.",
      "If it bypassed a debug preview, run one now against the current config before trusting any live output produced since the push.",
      "Document the change and its debug-preview result in the issue so the next config push has a precedent to compare against.",
    ],
  },
  auditor_schema_exhaustion: {
    title: "LLM auditor schema exhaustion",
    steps: [
      "Check CloudWatch logs for '[AUDITOR EXHAUSTION]' — this means the LLM returned an unparseable response across all MAX_AUDITOR_REPLAY attempts and the pipeline fell back to the defensive SUSPENSE safe-state.",
      "Treat the fallback's mandatory_deload_triggered=True as authoritative until a human re-reviews the week manually — it is a deliberate fail-safe, not a bug to just retry away.",
      "If exhaustion is recurring, the LLM prompt/schema contract has likely drifted from the model's actual output format — that's a Tier 3 fix, not something to resolve by re-running the same week again.",
    ],
  },
  ledger_reconciliation_mismatch: {
    title: "Ledger reconciliation mismatch",
    steps: [
      "Identify which ledger disagrees with which — system_memory_ledger, auditor_streak_ledger, and flaw_ledger are all keyed by week_id and should agree for the same week.",
      "Check whether a corrective rerun (CORRECTIVE_RERUN=true) happened for this week — that's the one case where a prior value is expected to change, not drift.",
      "Do not manually edit a ledger row to force agreement — identify which write path produced the wrong value and fix the source, or the mismatch will resurface next week.",
    ],
  },
  signoff_bypass: {
    title: "Weekly sign-off bypass",
    steps: [
      "Check analyst_weekly_signoff for this week — if a firmware copy or analysis action happened without a recorded sign-off, that's the bypass to document, not necessarily reverse.",
      "Confirm whether the retroactive sign-off panel was used appropriately (forgotten sign-off, caught late) versus the gate being circumvented entirely.",
      "If the gate itself was circumvented (not just a late sign-off), that's a Tier 4 process failure worth a permanent fix, not a one-off note.",
    ],
  },
};

export function getRunbook(leafId: string | null | undefined): Runbook | null {
  if (!leafId) return null;
  return RUNBOOKS[leafId] ?? null;
}
