import { NextResponse }               from "next/server";
import { auth }                       from "@/auth";
import { supabase, OPERATOR_USER_ID } from "@/lib/supabase";
import type { Session }               from "next-auth";

type AuthedSession = Session & { twoFactorVerified?: boolean };

function authed(session: Session | null): boolean {
  return !!(session as AuthedSession | null)?.twoFactorVerified;
}

export type AlarmState = {
  running:               boolean;
  started_at:            string | null;
  interval_min:          number;
  focus_min:             number;
  last_ack_cycle:        number;
  enforce_focus:         boolean;
  challenge_number:      number | null;  // browser sees this; watch endpoint strips it
  challenge_cycle:       number;
  challenge_status:      "pending" | "pass" | "fail" | null;
  challenge_expires_at:  string | null;
};

const DEFAULT: AlarmState = {
  running:              false,
  started_at:           null,
  interval_min:         15,
  focus_min:            2,
  last_ack_cycle:       -1,
  enforce_focus:        false,
  challenge_number:     null,
  challenge_cycle:      -1,
  challenge_status:     null,
  challenge_expires_at: null,
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

async function submitFailComment(userId?: string): Promise<void> {
  const now = new Date().toISOString();
  await supabase.from("comments").insert({
    content:    "[Focus Alert] fail challenge, user is not focus",
    created_at: now,
    Entry:      now,
    user_id:    userId ?? OPERATOR_USER_ID,
  });
}

/* ── GET — poll current state (browser) ── */
export async function GET() {
  try {
    const session = await auth() as Session | null;
    if (!authed(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const state = await readState();

    // Auto-expire pending challenge
    if (
      state.challenge_status === "pending" &&
      state.challenge_expires_at &&
      Date.now() > new Date(state.challenge_expires_at).getTime()
    ) {
      const userId = OPERATOR_USER_ID ?? (((session as AuthedSession).user) as { id?: string } | undefined)?.id;
      const newState: AlarmState = { ...state, challenge_status: "fail", last_ack_cycle: state.challenge_cycle };
      await writeState(newState, userId);
      await submitFailComment(userId);
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

    const body = await req.json() as {
      action:           string;
      intervalMin?:     unknown;
      focusMin?:        unknown;
      cycle?:           unknown;
      challengeNumber?: unknown;
      taps?:            unknown;
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
        running:              true,
        started_at:           new Date().toISOString(),
        interval_min:         iMin,
        focus_min:            Math.max(1, fMin),
        last_ack_cycle:       -1,
        challenge_number:     null,
        challenge_cycle:      -1,
        challenge_status:     null,
        challenge_expires_at: null,
      };
      await writeState(next, userId);
      return NextResponse.json(next);
    }

    if (body.action === "stop") {
      if (!current.running) return NextResponse.json(current);
      const next: AlarmState = { ...current, running: false, started_at: null };
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

    if (body.action === "challenge_start") {
      const cycle           = typeof body.cycle === "number" ? Math.floor(body.cycle) : -1;
      const challengeNumber = typeof body.challengeNumber === "number" ? Math.floor(body.challengeNumber) : 1;
      if (current.challenge_cycle >= cycle) return NextResponse.json(current); // already started
      const expiresAt = new Date(Date.now() + 2 * 60_000).toISOString();
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

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (e) {
    console.error("[alarm PUT]", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
