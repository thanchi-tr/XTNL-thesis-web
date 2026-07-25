"use client";

import { useEffect, useRef, useState } from "react";
import Sev1Banner from "@/components/session/Sev1Banner";

const POLL_MS               = 60_000;
const REMINDER_EVERY_MS     = 20 * 60_000; // 20 minutes
const REMINDER_DURATION_MS  = 20_000;      // 20 seconds

/**
 * Ocular-fatigue (20-20-20) governance guard for the session page, plus the
 * shared SEV1 banner (see Sev1Banner.tsx — also used standalone on the
 * analytics page).
 *
 * Polls the lightweight /ops-flags endpoint (not the full issues list) so
 * this can run continuously regardless of whether the Issues panel is even
 * open.
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
  const [visualFatigueActive, setVisualFatigueActive] = useState(false);
  const [reminder, setReminder] = useState(false);
  const activeRef        = useRef(visualFatigueActive);
  const lastReminderRef  = useRef(Date.now());
  const reminderTORef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { activeRef.current = visualFatigueActive; }, [visualFatigueActive]);

  /* Poll flags */
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch("/api/session/issues/ops-flags");
        if (r.ok && !cancelled) {
          const j = await r.json() as { visualFatigueActive?: boolean };
          setVisualFatigueActive(!!j.visualFatigueActive);
        }
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
      if (activeRef.current && Date.now() - lastReminderRef.current >= REMINDER_EVERY_MS) {
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
      <Sev1Banner />

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
