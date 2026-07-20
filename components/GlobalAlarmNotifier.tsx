"use client";

/**
 * GlobalAlarmNotifier — mounts in the root layout so alarm sounds fire on EVERY page.
 *
 * When the user is on the session page, AlarmConfig (inside SessionClient) owns the full
 * alarm UI (flash overlay, challenge, etc.). It sets sessionStorage["xtnl_alarm_tab"] = "1"
 * so this component silently yields to it.
 *
 * On all other pages this component plays the alarm beeps + browser notification when
 * a focus window opens, respecting the same trading-session gate that AlarmConfig uses.
 */

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { playAlarmBeeps, unlockAudio } from "../lib/alarmAudio";

/* ── Trading-session gate (identical to SessionClient) ───────────────────── */
function isInTradingSessionMelbourne(): boolean {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  }).formatToParts(new Date());
  const hour    = parseInt(parts.find(p => p.type === "hour")?.value    ?? "0", 10);
  const weekday = parts.find(p => p.type === "weekday")?.value ?? "Mon";
  const satOk   = weekday === "Sat" && hour < 1;
  if (!["Mon","Tue","Wed","Thu","Fri"].includes(weekday) && !satOk) return false;
  return (hour >= 18 && hour < 19) || hour >= 20 || hour < 1;
}

type SrvState = {
  running:         boolean;
  started_at:      string | null;
  interval_min:    number;
  focus_min:       number;
  last_ack_cycle:  number;
  enforce_focus:   boolean;
  challenge_status: string | null;
  challenge_cycle: number;
};

export default function GlobalAlarmNotifier() {
  const { data: session, status } = useSession();
  const roles: string[] = (session as any)?.roles ?? [];
  const canRecord = roles.some(r =>
    ["operator","analyst","strategist","fund_manager"].includes(r)
  );

  const srvRef          = useRef<SrvState | null>(null);
  const soundFiredCycle = useRef(-1);
  const pollRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const backupRef       = useRef<ReturnType<typeof setTimeout>  | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !canRecord) return;

    // Pre-unlock the AudioContext on every user click so background playback works.
    window.addEventListener("click", unlockAudio, { passive: true });

    const poll = async () => {
      // AlarmConfig (inside SessionClient, on /session) already polls this
      // same endpoint for its own UI and keeps srv state current — skip our
      // own redundant fetch whenever that page owns it, same flag this
      // component already checks before firing sound.
      if (sessionStorage.getItem("xtnl_alarm_tab") === "1") return;
      // The alarm only exists to notify during the trading session — outside
      // that window there's no plausible reason one would be running or
      // about to start, so there's nothing a poll could catch. The interval
      // below keeps ticking every 20s regardless (cheap, no timers change),
      // so as soon as the window opens the very next tick resumes fetching
      // — this only skips the actual network call, never delays detection
      // by more than one tick.
      if (!isInTradingSessionMelbourne()) return;
      try {
        const r = await fetch("/api/session/alarm");
        if (r.ok) srvRef.current = await r.json() as SrvState;
      } catch { /* network error — keep last cached state */ }
    };

    poll();
    pollRef.current = setInterval(poll, 20_000);

    /* ── Shared fire helper ──────────────────────────────────────────────── */
    const fireSound = (srv: SrvState, cycle: number) => {
      soundFiredCycle.current = cycle;
      const gateOn = localStorage.getItem("xtnl_trading_session_gate") === "1";
      if (gateOn && !isInTradingSessionMelbourne()) return;
      const vol = parseFloat(localStorage.getItem("xtnl_alarm_volume") ?? "0.7");
      playAlarmBeeps(vol);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        // Chrome for Android / Samsung Internet throw a synchronous
        // TypeError ("Illegal constructor") on `new Notification(...)` —
        // those browsers require the Service Worker showNotification() API
        // instead. Uncaught, this crashes the page into Next's generic
        // error boundary right when a focus window opens.
        try {
          new Notification("XTNL — Focus Window", {
            body:               `${srv.focus_min} min — return your attention now.`,
            requireInteraction: true,
            silent:             vol <= 0,
          });
        } catch { /* unsupported on this browser — alarm sound already fired */ }
      } else if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    };

    /* ── 1 s interval tick (handles visible-tab case) ────────────────────── */
    tickRef.current = setInterval(() => {
      if (sessionStorage.getItem("xtnl_alarm_tab") === "1") return;
      const srv = srvRef.current;
      if (!srv?.running || !srv.started_at) return;

      const epoch        = new Date(srv.started_at).getTime();
      const elapsed      = (Date.now() - epoch) / 1000;
      const cycleSec     = srv.interval_min * 60;
      const triggerSec   = (srv.interval_min - srv.focus_min) * 60;
      const cycle        = Math.floor(elapsed / cycleSec);
      const inFocusWindow = (elapsed % cycleSec) >= triggerSec;

      if (inFocusWindow && soundFiredCycle.current < cycle && srv.last_ack_cycle < cycle) {
        fireSound(srv, cycle);
      }
    }, 1_000);

    /* ── Background backup alarm ─────────────────────────────────────────── */
    // Chrome throttles setInterval to ≥ 1 s in background tabs and may freeze it
    // entirely for minimised windows. A one-shot setTimeout aimed at the exact
    // focus-window open time fires far more reliably than hoping the 1 s tick wakes.
    const scheduleBackup = () => {
      if (backupRef.current) clearTimeout(backupRef.current);
      if (sessionStorage.getItem("xtnl_alarm_tab") === "1") return; // session page owns it
      const srv = srvRef.current;
      if (!srv?.running || !srv.started_at) return;

      const epoch      = new Date(srv.started_at).getTime();
      const cycleSec   = srv.interval_min * 60;
      const triggerSec = (srv.interval_min - srv.focus_min) * 60;
      const elapsed    = (Date.now() - epoch) / 1000;
      const cyclePos   = elapsed % cycleSec;

      // ms until the next focus window opens
      const msToFocus  = cyclePos >= triggerSec
        ? (cycleSec - cyclePos + triggerSec) * 1_000   // next cycle
        : (triggerSec - cyclePos) * 1_000;              // this cycle

      if (msToFocus < 1_000) return; // let the 1 s tick handle imminent windows

      backupRef.current = setTimeout(() => {
        if (sessionStorage.getItem("xtnl_alarm_tab") !== "1") {
          const srv2 = srvRef.current;
          if (srv2?.running && srv2.started_at) {
            const epoch2     = new Date(srv2.started_at).getTime();
            const elapsed2   = (Date.now() - epoch2) / 1000;
            const cycleSec2  = srv2.interval_min * 60;
            const triggerSec2 = (srv2.interval_min - srv2.focus_min) * 60;
            const cn          = Math.floor(elapsed2 / cycleSec2);
            const cp          = elapsed2 % cycleSec2;
            if (cp >= triggerSec2 && soundFiredCycle.current < cn && srv2.last_ack_cycle < cn) {
              fireSound(srv2, cn);
            }
          }
        }
        scheduleBackup(); // chain for the next focus window
      }, msToFocus);
    };

    const onVisibilityChange = () => { if (document.hidden) scheduleBackup(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    if (document.hidden) scheduleBackup();

    return () => {
      window.removeEventListener("click", unlockAudio);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (pollRef.current)  clearInterval(pollRef.current);
      if (tickRef.current)  clearInterval(tickRef.current);
      if (backupRef.current) clearTimeout(backupRef.current);
    };
  }, [status, canRecord]);

  return null;
}
