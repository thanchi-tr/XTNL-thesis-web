import { NextResponse }               from "next/server";
import { auth }                       from "@/auth";
import { supabase, OPERATOR_USER_ID } from "@/lib/supabase";
import type { Session }               from "next-auth";

type AuthedSession = Session & { twoFactorVerified?: boolean };

function authed(session: Session | null): boolean {
  return !!(session as AuthedSession | null)?.twoFactorVerified;
}

export type SessionWindow = { start: string; end: string }; // "HH:MM" Melbourne local time

export type AlarmState = {
  running:                  boolean;
  started_at:               string | null;
  scheduled_start:          string | null;
  interval_min:             number;
  focus_min:                number;
  last_ack_cycle:           number;
  enforce_focus:            boolean;
  entry_checklist_enabled:  boolean;
  challenge_number:         number | null;
  challenge_cycle:          number;
  challenge_status:         "pending" | "pass" | "fail" | null;
  challenge_expires_at:     string | null;
  fail_streak:              number;
  completions_toward_reset: number;
  session_windows:          SessionWindow[] | null;
};

const DEFAULT: AlarmState = {
  running:                  false,
  started_at:               null,
  scheduled_start:          null,
  interval_min:             15,
  focus_min:                2,
  last_ack_cycle:           -1,
  enforce_focus:            false,
  entry_checklist_enabled:  false,
  challenge_number:         null,
  challenge_cycle:          -1,
  challenge_status:         null,
  challenge_expires_at:     null,
  fail_streak:              0,
  completions_toward_reset: 0,
  session_windows:          null,
};

const PREFIX = "alarm_state:";

async function readState(): Promise<AlarmState> {
  const { data } = await supabase
    .from("comments")
    .select("content")
    .like("content", `${PREFIX}%`)
    .order("Entry", { ascending: false })
    .limit(1)
    .single();

  if (!data) return { ...DEFAULT };
  try {
    return { ...DEFAULT, ...JSON.parse(data.content.slice(PREFIX.length)) as Partial<AlarmState> };
  } catch {
    return { ...DEFAULT };
  }
}

async function writeState(state: AlarmState, userId?: string): Promise<void> {
  const content = PREFIX + JSON.stringify(state);

  const { data: existing } = await supabase
    .from("comments")
    .select("Entry")
    .like("content", `${PREFIX}%`)
    .order("Entry", { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    const { error } = await supabase.from("comments").update({ content }).eq("Entry", existing.Entry);
    if (error) throw new Error(error.message);
  } else {
    const now = new Date().toISOString();
    const row: Record<string, unknown> = { content, created_at: now, Entry: now };
    if (userId) row.user_id = userId;
    const { error } = await supabase.from("comments").insert(row);
    if (error) throw new Error(error.message);
  }
}

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

async function submitFailComment(streak: number, userId?: string): Promise<void> {
  const threshold = resetThreshold(streak);
  const content   = `[Focus Alert] fail challenge — ${melbourneTime()} AEST | fail streak = ${streak} | needs ${threshold} pass(es) to reset`;
  const now       = new Date().toISOString();
  const uid       = userId ?? OPERATOR_USER_ID;
  await supabase.from("comments").insert({
    content,
    created_at: now,
    Entry:      now,
    ...(uid ? { user_id: uid } : {}),
  });
}

async function submitResetComment(prevStreak: number, userId?: string): Promise<void> {
  const content = `[Focus Alert] fail streak cleared — ${melbourneTime()} AEST | operator successfully completed required challenge(s) — fail streak of ${prevStreak} resolved`;
  const now     = new Date().toISOString();
  const uid     = userId ?? OPERATOR_USER_ID;
  await supabase.from("comments").insert({
    content,
    created_at: now,
    Entry:      now,
    ...(uid ? { user_id: uid } : {}),
  });
}

/* ── GET — poll current state (browser) ── */
export async function GET() {
  try {
    const session = await auth() as Session | null;
    if (!authed(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const state = await readState();
    const userId = OPERATOR_USER_ID ?? (((session as AuthedSession).user) as { id?: string } | undefined)?.id;

    // Auto-start: scheduled time has arrived
    if (!state.running && state.scheduled_start && Date.now() >= new Date(state.scheduled_start).getTime()) {
      const next: AlarmState = {
        ...state,
        running:                  true,
        started_at:               state.scheduled_start,  // honour exact scheduled moment
        scheduled_start:          null,
        last_ack_cycle:           -1,
        challenge_number:         null,
        challenge_cycle:          -1,
        challenge_status:         null,
        challenge_expires_at:     null,
        fail_streak:              0,
        completions_toward_reset: 0,
      };
      await writeState(next, userId);
      return NextResponse.json(next);
    }

    // Auto-expire pending challenge
    if (
      state.challenge_status === "pending" &&
      state.challenge_expires_at &&
      Date.now() > new Date(state.challenge_expires_at).getTime()
    ) {
      const newStreak  = state.fail_streak + 1;
      const newState: AlarmState = {
        ...state,
        challenge_status:         "fail",
        last_ack_cycle:           state.challenge_cycle,
        fail_streak:              newStreak,
        completions_toward_reset: 0,
      };
      await writeState(newState, userId);
      await submitFailComment(newStreak, userId);
      return NextResponse.json(newState);
    }

    return NextResponse.json(state);
  } catch (e) {
    console.error("[alarm GET]", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

/* ── PUT — mutate state (idempotent) ── */
export async function PUT(req: Request) {
  try {
    const session = await auth() as Session | null;
    if (!authed(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = OPERATOR_USER_ID
      ?? (((session as AuthedSession).user) as { id?: string } | undefined)?.id;

    const roles: string[] = ((session as any)?.roles as string[]) ?? [];
    const isStrategist = roles.some(r => ["strategist", "fund_manager"].includes(r));

    const body = await req.json() as {
      action:           string;
      intervalMin?:     unknown;
      focusMin?:        unknown;
      cycle?:           unknown;
      challengeNumber?: unknown;
      taps?:            unknown;
      scheduledStart?:  unknown;
      sessionWindows?:  unknown;
    };

    const current = await readState();

    if (body.action === "start") {
      if (current.running) return NextResponse.json(current);
      const iMin = typeof body.intervalMin === "number" && body.intervalMin >= 2
        ? Math.min(Math.floor(body.intervalMin), 120) : current.interval_min;
      const fMin = typeof body.focusMin === "number" && body.focusMin >= 1
        ? Math.min(Math.floor(body.focusMin), iMin - 1) : Math.min(current.focus_min, iMin - 1);
      const next: AlarmState = {
        ...current,
        running:                  true,
        started_at:               new Date().toISOString(),
        scheduled_start:          null,
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
      await writeState(next, userId);
      return NextResponse.json(next);
    }

    if (body.action === "schedule") {
      if (current.running) return NextResponse.json({ error: "Cannot schedule while alarm is running." }, { status: 400 });
      const raw = typeof body.scheduledStart === "string" ? body.scheduledStart : null;
      if (!raw) return NextResponse.json({ error: "scheduledStart required." }, { status: 400 });
      const scheduledMs = new Date(raw).getTime();
      if (isNaN(scheduledMs) || scheduledMs <= Date.now()) {
        return NextResponse.json({ error: "scheduledStart must be a valid future ISO timestamp." }, { status: 400 });
      }
      const iMin = typeof body.intervalMin === "number" && body.intervalMin >= 2
        ? Math.min(Math.floor(body.intervalMin), 120) : current.interval_min;
      const fMin = typeof body.focusMin === "number" && body.focusMin >= 1
        ? Math.min(Math.floor(body.focusMin), iMin - 1) : Math.min(current.focus_min, iMin - 1);
      const next: AlarmState = {
        ...current,
        running:              false,
        scheduled_start:      raw,
        interval_min:         iMin,
        focus_min:            Math.max(1, fMin),
      };
      await writeState(next, userId);
      return NextResponse.json(next);
    }

    if (body.action === "cancel_schedule") {
      if (!current.scheduled_start) return NextResponse.json(current);
      const next: AlarmState = { ...current, scheduled_start: null };
      await writeState(next, userId);
      return NextResponse.json(next);
    }

    if (body.action === "stop") {
      if (!current.running) return NextResponse.json(current);
      const next: AlarmState = {
        ...current,
        running:                  false,
        started_at:               null,
        scheduled_start:          null,
        fail_streak:              0,
        completions_toward_reset: 0,
      };
      await writeState(next, userId);
      return NextResponse.json(next);
    }

    if (body.action === "ack") {
      const cycle = typeof body.cycle === "number" ? Math.floor(body.cycle) : -1;
      if (current.last_ack_cycle >= cycle) return NextResponse.json(current);
      const next: AlarmState = { ...current, last_ack_cycle: cycle };
      await writeState(next, userId);
      return NextResponse.json(next);
    }

    if (body.action === "toggle_enforce_focus") {
      const next: AlarmState = { ...current, enforce_focus: !current.enforce_focus };
      await writeState(next, userId);
      return NextResponse.json(next);
    }

    if (body.action === "toggle_entry_checklist") {
      const next: AlarmState = { ...current, entry_checklist_enabled: !current.entry_checklist_enabled };
      await writeState(next, userId);
      return NextResponse.json(next);
    }

    if (body.action === "challenge_start") {
      const cycle           = typeof body.cycle === "number" ? Math.floor(body.cycle) : -1;
      const challengeNumber = typeof body.challengeNumber === "number" ? Math.floor(body.challengeNumber) : 1;
      if (current.challenge_cycle >= cycle) return NextResponse.json(current); // already started
      const expiresAt = new Date(Date.now() + 30_000).toISOString();
      const next: AlarmState = {
        ...current,
        challenge_number:     challengeNumber,
        challenge_cycle:      cycle,
        challenge_status:     "pending",
        challenge_expires_at: expiresAt,
      };
      await writeState(next, userId);
      return NextResponse.json(next);
    }

    if (body.action === "set_session_windows") {
      if (!isStrategist) return NextResponse.json({ error: "Strategist role required." }, { status: 403 });
      const raw = body.sessionWindows;
      const windows: SessionWindow[] | null = Array.isArray(raw)
        ? (raw as unknown[])
            .filter((w): w is { start: string; end: string } =>
              typeof (w as any)?.start === "string" && typeof (w as any)?.end === "string"
            )
            .map(w => ({ start: w.start.trim(), end: w.end.trim() }))
        : null;
      const next: AlarmState = { ...current, session_windows: windows };
      await writeState(next, userId);
      return NextResponse.json(next);
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (e) {
    console.error("[alarm PUT]", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
