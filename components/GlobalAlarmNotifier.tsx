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

/* ── Audio (identical to SessionClient.playAlarmBeeps) ───────────────────── */
function playAlarmBeeps(volume: number) {
  if (volume <= 0) return;
  try {
    const ctx  = new AudioContext();
    const dest = ctx.destination;
    const v    = Math.min(1, Math.max(0, volume));
    const tone = (t: number, freq: number, dur: number, rel = 1.0) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(v * rel, t + 0.008);
      gain.gain.setValueAtTime(v * rel, t + dur - 0.03);
      gain.gain.linearRampToValueAtTime(0, t + dur);
      osc.start(t); osc.stop(t + dur + 0.01);
    };
    const now = ctx.currentTime;
    tone(now,        1320, 0.08, 0.55);
    tone(now + 0.11, 1320, 0.08, 0.55);
    tone(now + 0.28, 1760, 0.22, 0.65);
    tone(now + 0.70, 1320, 0.08, 0.60);
    tone(now + 0.81, 1320, 0.08, 0.60);
    tone(now + 0.98, 1760, 0.22, 0.70);
    tone(now + 1.40, 1320, 0.08, 0.65);
    tone(now + 1.51, 1320, 0.08, 0.65);
    tone(now + 1.68, 1760, 0.36, 0.75);
    setTimeout(() => ctx.close(), 2500);
  } catch { /* AudioContext unavailable */ }
}

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

  const srvRef           = useRef<SrvState | null>(null);
  const soundFiredCycle  = useRef(-1);
  const pollRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef          = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Only run for authenticated users with record access
    if (status !== "authenticated" || !canRecord) return;

    const poll = async () => {
      try {
        const r = await fetch("/api/session/alarm");
        if (r.ok) srvRef.current = await r.json() as SrvState;
      } catch { /* network error — keep last cached state */ }
    };

    poll();
    pollRef.current = setInterval(poll, 20_000);

    tickRef.current = setInterval(() => {
      // Session page's AlarmConfig is mounted — it owns the alarm UI, yield to it
      if (sessionStorage.getItem("xtnl_alarm_tab") === "1") return;

      const srv = srvRef.current;
      if (!srv?.running || !srv.started_at) return;

      const startMs    = new Date(srv.started_at).getTime();
      const elapsedMs  = Date.now() - startMs;
      const intervalMs = srv.interval_min * 60_000;
      const focusMs    = srv.focus_min    * 60_000;
      if (intervalMs <= 0) return;

      const cycle        = Math.floor(elapsedMs / intervalMs);
      const inFocusWindow = (elapsedMs % intervalMs) >= (intervalMs - focusMs);

      if (inFocusWindow && soundFiredCycle.current < cycle && srv.last_ack_cycle < cycle) {
        soundFiredCycle.current = cycle;

        // Respect trading-session gate from localStorage (same key as AlarmConfig)
        const gateOn = localStorage.getItem("xtnl_trading_session_gate") === "1";
        if (gateOn && !isInTradingSessionMelbourne()) return;

        const vol = parseFloat(localStorage.getItem("xtnl_alarm_volume") ?? "0.7");
        playAlarmBeeps(vol);

        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("XTNL — Focus Window", {
            body:              `${srv.focus_min} min — return your attention now.`,
            requireInteraction: true,
            silent:            vol <= 0,
          });
        } else if (typeof Notification !== "undefined" && Notification.permission === "default") {
          Notification.requestPermission().catch(() => {});
        }
      }
    }, 1_000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [status, canRecord]);

  return null;
}
