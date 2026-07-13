/**
 * Watch-authenticated mirror of /api/session/alarm.
 * Uses Bearer JWT (from watch token) instead of NextAuth session cookie.
 * Never returns challenge_number — watch must not see it (anti-cheat).
 */
import { NextResponse }           from "next/server";
import { supabase, OPERATOR_USER_ID } from "@/lib/supabase";
import { verifyWatchTokenReason } from "@/lib/watchJwt";

export type SessionWindow = {
  start: string;   // "HH:MM" Melbourne local time
  end:   string;   // "HH:MM" Melbourne local time
  days:  number[]; // 0=Sun 1=Mon … 6=Sat; empty = every day
};

// AlarmState is the runtime blob — session_windows are stored separately.
export type AlarmState = {
  running:                  boolean;
  started_at:               string | null;
  interval_min:             number;
  focus_min:                number;
  last_ack_cycle:           number;
  enforce_focus:            boolean;
  challenge_number:         number | null;
  challenge_cycle:          number;
  challenge_status:         "pending" | "pass" | "fail" | null;
  challenge_expires_at:     string | null;
  fail_streak:              number;
  completions_toward_reset: number;
};

const DEFAULT: AlarmState = {
  running:                  false,
  started_at:               null,
  interval_min:             15,
  focus_min:                2,
  last_ack_cycle:           -1,
  enforce_focus:            false,
  challenge_number:         null,
  challenge_cycle:          -1,
  challenge_status:         null,
  challenge_expires_at:     null,
  fail_streak:              0,
  completions_toward_reset: 0,
};

const PREFIX = "alarm_state:";

// ── Streak helpers ────────────────────────────────────────────────────────────

function resetThreshold(streak: number): number {
  if (streak >= 8) return 3;
  if (streak >= 4) return 2;
  return 1;
}

function melbourneTime(): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone:  "Australia/Melbourne",
    dateStyle: "short",
    timeStyle: "medium",
    hour12:    false,
  }).format(new Date());
}

/** Returns true when current Melbourne time is OUTSIDE all configured session windows. */
function isInSessionBreak(windows: SessionWindow[] | null): boolean {
  if (!windows || windows.length === 0) return false;
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false,
  }).formatToParts(new Date());
  const h       = parseInt(parts.find(p => p.type === "hour")?.value    ?? "0", 10);
  const m       = parseInt(parts.find(p => p.type === "minute")?.value  ?? "0", 10);
  const dayStr  = parts.find(p => p.type === "weekday")?.value ?? "Mon";
  const DAY_MAP: Record<string, number> = { Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6 };
  const dayNum  = DAY_MAP[dayStr] ?? 1;
  const nowMin  = h * 60 + m;
  const inAny   = windows.some(w => {
    if (w.days && w.days.length > 0 && !w.days.includes(dayNum)) return false;
    const [sh, sm] = w.start.split(":").map(Number);
    const [eh, em] = w.end.split(":").map(Number);
    const s = sh * 60 + sm, e = eh * 60 + em;
    return s <= e ? (nowMin >= s && nowMin < e) : (nowMin >= s || nowMin < e);
  });
  return !inAny;
}

// ── DB helpers ────────────────────────────────────────────────────────────────

function strip(state: AlarmState): Omit<AlarmState, "challenge_number"> & { challenge_number: null } {
  return { ...state, challenge_number: null };
}

async function readState(): Promise<AlarmState> {
  const { data } = await supabase.from("comments").select("content")
    .like("content", `${PREFIX}%`).order("Entry", { ascending: false }).limit(1).single();
  if (!data) return { ...DEFAULT };
  try {
    const { session_windows: _sw, ...rest } = JSON.parse(data.content.slice(PREFIX.length)) as Partial<AlarmState> & { session_windows?: unknown };
    return { ...DEFAULT, ...rest };
  }
  catch { return { ...DEFAULT }; }
}

async function readWindows(): Promise<SessionWindow[] | null> {
  const { data } = await supabase
    .from("session_schedule")
    .select("windows")
    .order("set_at", { ascending: false })
    .limit(1)
    .single();
  if (!data) return null;
  try { return data.windows as SessionWindow[]; }
  catch { return null; }
}

async function writeState(state: AlarmState): Promise<void> {
  const content = PREFIX + JSON.stringify(state);
  const { data: existing } = await supabase.from("comments").select("Entry")
    .like("content", `${PREFIX}%`).order("Entry", { ascending: false }).limit(1).single();
  if (existing) {
    await supabase.from("comments").update({ content }).eq("Entry", existing.Entry);
  } else {
    const now = new Date().toISOString();
    await supabase.from("comments").insert({ content, created_at: now, Entry: now, ...(OPERATOR_USER_ID ? { user_id: OPERATOR_USER_ID } : {}) });
  }
}

async function submitFailComment(streak: number): Promise<void> {
  const threshold = resetThreshold(streak);
  const content   = `[Focus Alert] fail challenge — ${melbourneTime()} AEST | fail streak = ${streak} | needs ${threshold} pass(es) to reset`;
  const now       = new Date().toISOString();
  await supabase.from("comments").insert({
    content,
    created_at: now,
    Entry:      now,
    ...(OPERATOR_USER_ID ? { user_id: OPERATOR_USER_ID } : {}),
  });
}

async function submitResetComment(prevStreak: number): Promise<void> {
  const content = `[Focus Alert] fail streak cleared — ${melbourneTime()} AEST | operator successfully completed required challenge(s) — fail streak of ${prevStreak} resolved`;
  const now     = new Date().toISOString();
  await supabase.from("comments").insert({
    content,
    created_at: now,
    Entry:      now,
    ...(OPERATOR_USER_ID ? { user_id: OPERATOR_USER_ID } : {}),
  });
}

async function isDeviceDropped(deviceId: string): Promise<boolean> {
  const { data } = await supabase
    .from("watch_devices")
    .select("dropped")
    .eq("device_id", deviceId)
    .single();
  return data?.dropped === true;
}

function currentCycleInfo(state: AlarmState): { cycle: number; inFocus: boolean } | null {
  if (!state.running || !state.started_at) return null;
  const startMs    = new Date(state.started_at).getTime();
  const elapsedMs  = Date.now() - startMs;
  const intervalMs = state.interval_min * 60_000;
  const focusMs    = state.focus_min * 60_000;
  if (intervalMs <= 0) return null;
  const cycle   = Math.floor(elapsedMs / intervalMs);
  const inFocus = (elapsedMs % intervalMs) >= (intervalMs - focusMs);
  return { cycle, inFocus };
}

async function auth(req: Request): Promise<{ claims: { userId: string }; reason: null } | { claims: null; reason: string }> {
  const header = req.headers.get("Authorization") ?? "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return { claims: null, reason: "No Bearer token in Authorization header" };
  return verifyWatchTokenReason(token);
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { claims, reason } = await auth(req);
  if (!claims) return NextResponse.json({ error: "Unauthorized", reason }, { status: 401 });

  // Instant disconnect: if the operator dropped this device, reject immediately.
  const deviceId = req.headers.get("X-Device-Id");
  if (deviceId && await isDeviceDropped(deviceId)) {
    return NextResponse.json({ error: "Unauthorized", reason: "Device dropped" }, { status: 401 });
  }

  try {
    let [state, windows] = await Promise.all([readState(), readWindows()]);

    const inBreak = isInSessionBreak(windows);

    if (state.enforce_focus && !inBreak) {
      const info = currentCycleInfo(state);

      // Auto-generate challenge when watch enters a new focus cycle (master did not generate one yet)
      if (info?.inFocus && state.challenge_cycle < info.cycle) {
        const n         = Math.floor(Math.random() * 5) + 1;
        const expiresAt = new Date(Date.now() + 30_000).toISOString();
        state = {
          ...state,
          challenge_number:     n,
          challenge_cycle:      info.cycle,
          challenge_status:     "pending",
          challenge_expires_at: expiresAt,
        };
        await writeState(state);
      }

      // Auto-expire overdue pending challenge
      if (
        state.challenge_status === "pending" &&
        state.challenge_expires_at &&
        Date.now() > new Date(state.challenge_expires_at).getTime()
      ) {
        const newStreak = state.fail_streak + 1;
        state = {
          ...state,
          challenge_status:         "fail",
          last_ack_cycle:           state.challenge_cycle,
          fail_streak:              newStreak,
          completions_toward_reset: 0,
        };
        await writeState(state);
        await submitFailComment(newStreak);
      }
    }

    return NextResponse.json({ ...strip(state), session_windows: windows, in_session_break: inBreak });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── PUT ───────────────────────────────────────────────────────────────────────

export async function PUT(req: Request) {
  const { claims: putClaims, reason: putReason } = await auth(req);
  if (!putClaims) return NextResponse.json({ error: "Unauthorized", reason: putReason }, { status: 401 });
  try {
    const body = await req.json() as {
      action:       string;
      intervalMin?: number;
      focusMin?:    number;
      cycle?:       number;
      taps?:        number;
    };
    const cur = await readState();

    if (body.action === "start") {
      if (cur.running) return NextResponse.json(strip(cur));
      const iMin = typeof body.intervalMin === "number" && body.intervalMin >= 2
        ? Math.min(Math.floor(body.intervalMin), 120) : cur.interval_min;
      const fMin = typeof body.focusMin === "number" && body.focusMin >= 1
        ? Math.min(Math.floor(body.focusMin), iMin - 1) : Math.min(cur.focus_min, iMin - 1);
      const next: AlarmState = {
        ...cur,
        running:                  true,
        started_at:               new Date().toISOString(),
        interval_min:             iMin,
        focus_min:                Math.max(1, fMin),
        last_ack_cycle:           -1,
        challenge_number:         null,
        challenge_cycle:          -1,
        challenge_status:         null,
        challenge_expires_at:     null,
        fail_streak:              0,
        completions_toward_reset: 0,
      };
      await writeState(next);
      return NextResponse.json(strip(next));
    }

    if (body.action === "stop") {
      if (!cur.running) return NextResponse.json(strip(cur));
      const next: AlarmState = {
        ...cur,
        running:                  false,
        started_at:               null,
        fail_streak:              0,
        completions_toward_reset: 0,
      };
      await writeState(next);
      return NextResponse.json(strip(next));
    }

    if (body.action === "ack") {
      const cycle = typeof body.cycle === "number" ? Math.floor(body.cycle) : -1;
      if (cur.last_ack_cycle >= cycle) return NextResponse.json(strip(cur));
      const next = { ...cur, last_ack_cycle: cycle };
      await writeState(next);
      return NextResponse.json(strip(next));
    }

    if (body.action === "challenge_result") {
      const cycle = typeof body.cycle === "number" ? Math.floor(body.cycle) : -1;
      const taps  = typeof body.taps  === "number" ? Math.floor(body.taps)  : -1;

      if (cur.challenge_status !== "pending" || cur.challenge_cycle !== cycle) {
        return NextResponse.json(strip(cur));
      }

      const expired = cur.challenge_expires_at
        && Date.now() > new Date(cur.challenge_expires_at).getTime();
      const pass = !expired && taps === cur.challenge_number;

      let fail_streak              = cur.fail_streak;
      let completions_toward_reset = cur.completions_toward_reset;
      const prevStreak             = fail_streak;
      let streakCleared            = false;

      if (pass) {
        completions_toward_reset++;
        if (completions_toward_reset >= resetThreshold(fail_streak)) {
          fail_streak              = 0;
          completions_toward_reset = 0;
          streakCleared            = true;
        }
      } else {
        fail_streak++;
        completions_toward_reset = 0;
      }

      const next: AlarmState = {
        ...cur,
        challenge_status:         pass ? "pass" : "fail",
        last_ack_cycle:           cycle,
        fail_streak,
        completions_toward_reset,
      };
      await writeState(next);
      if (!pass)       await submitFailComment(fail_streak);
      if (streakCleared) await submitResetComment(prevStreak);
      return NextResponse.json(strip(next));
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
