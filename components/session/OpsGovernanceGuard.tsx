"use client";

import { useEffect, useRef, useState } from "react";

const POLL_MS               = 60_000;
const REMINDER_EVERY_MS     = 20 * 60_000; // 20 minutes
const REMINDER_DURATION_MS  = 20_000;      // 20 seconds

interface OpsFlags { sev1Active: boolean; visualFatigueActive: boolean }

/**
 * SEV1 + ocular-fatigue (20-20-20) governance guard for the session page.
 *
 * Polls the lightweight /ops-flags endpoint (not the full issues list) so
 * this can run continuously regardless of whether the Issues panel is even
 * open.
 *
 * SEV1: a persistent banner, not a fabricated "automated engine halt" —
 * this frontend has no live control over the Python pipeline's actual halt
 * state (that's set by the risk engine during a live run), so the honest
 * implementation is an unmissable operator directive, not pretend
 * automation.
 *
 * Visual fatigue: while an open Biological Substrate → Visual Fatigue issue
 * exists, enforces a 20-second look-away prompt every 20 minutes (the
 * clinical 20-20-20 rule) via this app's existing full-screen-overlay
 * pattern (matching the challenge/alarm overlays elsewhere in the session
 * page) rather than attempting to selectively dim individual panels deep
 * inside SessionClient. Deliberately has no dismiss action — biometric
 * compliance verification (the "Wear OS haptic" idea) isn't something this
 * app can actually check, so the honest enforcement is simply not offering
 * an early-exit click, not simulating a check that doesn't exist.
 */
export default function OpsGovernanceGuard() {
  const [flags,    setFlags]    = useState<OpsFlags>({ sev1Active: false, visualFatigueActive: false });
  const [reminder, setReminder] = useState(false);
  const flagsRef         = useRef(flags);
  const lastReminderRef  = useRef(Date.now());
  const reminderTORef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { flagsRef.current = flags; }, [flags]);

  /* Poll flags */
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch("/api/session/issues/ops-flags");
        if (r.ok && !cancelled) setFlags(await r.json());
      } catch { /* keep last known flags */ }
    };
    void poll();
    const id = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  /* 20-20-20 reminder scheduler — checked every poll tick rather than a
     single 20-minute setTimeout, so it stays correct across tab backgrounding
     (mirrors the backup-alarm pattern used elsewhere in this app). */
  useEffect(() => {
    const check = () => {
      if (flagsRef.current.visualFatigueActive && Date.now() - lastReminderRef.current >= REMINDER_EVERY_MS) {
        lastReminderRef.current = Date.now();
        setReminder(true);
        reminderTORef.current = setTimeout(() => setReminder(false), REMINDER_DURATION_MS);
      }
    };
    const id = setInterval(check, POLL_MS);
    return () => { clearInterval(id); if (reminderTORef.current) clearTimeout(reminderTORef.current); };
  }, []);

  return (
    <>
      {flags.sev1Active && (
        <div
          role="alert"
          className="mono"
          style={{
            position:      "sticky",
            top:           0,
            zIndex:        500,
            padding:       "7px 16px",
            background:    "rgba(240,58,87,0.14)",
            borderBottom:  "1px solid rgba(240,58,87,0.4)",
            color:         "#f03a57",
            fontSize:      11,
            fontWeight:    700,
            textAlign:     "center",
            letterSpacing: "0.04em",
          }}
        >
          ⚠ SEV1 — DIRE/CRITICAL issue open. Halt live trading and resolve before continuing.
        </div>
      )}

      {reminder && (
        <div
          style={{
            position:             "fixed",
            inset:                0,
            zIndex:                1200,
            background:            "rgba(4,8,15,0.94)",
            backdropFilter:        "blur(10px)",
            WebkitBackdropFilter:  "blur(10px)",
            display:               "flex",
            flexDirection:         "column",
            alignItems:            "center",
            justifyContent:        "center",
            gap:                   14,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-0)", letterSpacing: "0.02em" }}>
            20-20-20 — Look at something 20 feet away
          </div>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
            Visual Fatigue is logged for this session — hold for 20 seconds
          </div>
        </div>
      )}
    </>
  );
}
