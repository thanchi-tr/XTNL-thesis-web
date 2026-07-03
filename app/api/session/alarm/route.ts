/*
  Alarm state sync — REST pub/sub, no persistent connections.
  No schema migration needed: piggybacks on the existing `comments` table
  using an "alarm_state:" prefix, identical to the "session_contract:" pattern.

  The latest comment row whose content starts with "alarm_state:" is the
  authoritative state. Each mutation inserts a new row; the previous rows
  are left in place (same as session_contract).

  All mutations are idempotent:
    start  → no-op if latest state already has running=true
    stop   → no-op if latest state already has running=false
    ack N  → no-op if latest state already has last_ack_cycle >= N
*/

import { NextResponse }               from "next/server";
import { auth }                       from "@/auth";
import { supabase, OPERATOR_USER_ID } from "@/lib/supabase";
import type { Session }               from "next-auth";

type AuthedSession = Session & { twoFactorVerified?: boolean };

function authed(session: Session | null): boolean {
  return !!(session as AuthedSession | null)?.twoFactorVerified;
}

export type AlarmState = {
  running:        boolean;
  started_at:     string | null;
  interval_min:   number;
  focus_min:      number;
  last_ack_cycle: number;
};

const DEFAULT: AlarmState = {
  running:        false,
  started_at:     null,
  interval_min:   15,
  focus_min:      2,
  last_ack_cycle: -1,
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
    return JSON.parse(data.content.slice(PREFIX.length)) as AlarmState;
  } catch {
    return { ...DEFAULT };
  }
}

async function writeState(state: AlarmState, userId?: string): Promise<void> {
  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    content:    PREFIX + JSON.stringify(state),
    created_at: now,
    Entry:      now,
  };
  if (userId) row.user_id = userId;
  const { error } = await supabase.from("comments").insert(row);
  if (error) throw new Error(error.message);
}

/* ── GET — poll current state ── */
export async function GET() {
  try {
    const session = await auth() as Session | null;
    if (!authed(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    return NextResponse.json(await readState());
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
      action:       "start" | "stop" | "ack";
      intervalMin?: unknown;
      focusMin?:    unknown;
      cycle?:       unknown;
    };

    const current = await readState();

    if (body.action === "start") {
      if (current.running) return NextResponse.json(current);   // already running — no-op

      const iMin = typeof body.intervalMin === "number" && body.intervalMin >= 2
        ? Math.min(Math.floor(body.intervalMin), 120)
        : current.interval_min;
      const fMin = typeof body.focusMin === "number" && body.focusMin >= 1
        ? Math.min(Math.floor(body.focusMin), iMin - 1)
        : Math.min(current.focus_min, iMin - 1);

      const next: AlarmState = {
        running:        true,
        started_at:     new Date().toISOString(),
        interval_min:   iMin,
        focus_min:      Math.max(1, fMin),
        last_ack_cycle: -1,
      };
      await writeState(next, userId);
      return NextResponse.json(next);
    }

    if (body.action === "stop") {
      if (!current.running) return NextResponse.json(current);  // already stopped — no-op

      const next: AlarmState = { ...current, running: false, started_at: null };
      await writeState(next, userId);
      return NextResponse.json(next);
    }

    if (body.action === "ack") {
      const cycle = typeof body.cycle === "number" ? Math.floor(body.cycle) : -1;
      if (current.last_ack_cycle >= cycle) return NextResponse.json(current); // already acked — no-op

      const next: AlarmState = { ...current, last_ack_cycle: cycle };
      await writeState(next, userId);
      return NextResponse.json(next);
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (e) {
    console.error("[alarm PUT]", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
