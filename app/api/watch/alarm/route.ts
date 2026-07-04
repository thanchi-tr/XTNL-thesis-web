/**
 * Watch-authenticated mirror of /api/session/alarm.
 * Uses Bearer JWT (from watch token) instead of NextAuth session cookie.
 * Logic is identical to the browser route — single source of truth in Supabase.
 */
import { NextResponse }           from "next/server";
import { supabase, OPERATOR_USER_ID } from "@/lib/supabase";
import { verifyWatchToken }       from "@/lib/watchJwt";

export type AlarmState = {
  running:        boolean;
  started_at:     string | null;
  interval_min:   number;
  focus_min:      number;
  last_ack_cycle: number;
};

const DEFAULT: AlarmState = { running: false, started_at: null, interval_min: 15, focus_min: 2, last_ack_cycle: -1 };
const PREFIX = "alarm_state:";

async function readState(): Promise<AlarmState> {
  const { data } = await supabase.from("comments").select("content")
    .like("content", `${PREFIX}%`).order("Entry", { ascending: false }).limit(1).single();
  if (!data) return { ...DEFAULT };
  try { return JSON.parse(data.content.slice(PREFIX.length)) as AlarmState; } catch { return { ...DEFAULT }; }
}

async function writeState(state: AlarmState): Promise<void> {
  const content = PREFIX + JSON.stringify(state);
  const { data: existing } = await supabase.from("comments").select("Entry")
    .like("content", `${PREFIX}%`).order("Entry", { ascending: false }).limit(1).single();
  if (existing) {
    await supabase.from("comments").update({ content }).eq("Entry", existing.Entry);
  } else {
    const now = new Date().toISOString();
    await supabase.from("comments").insert({ content, created_at: now, Entry: now, user_id: OPERATOR_USER_ID });
  }
}

async function auth(req: Request) {
  const header = req.headers.get("Authorization") ?? "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  return verifyWatchToken(token);
}

export async function GET(req: Request) {
  if (!await auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json(await readState()); }
  catch { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}

export async function PUT(req: Request) {
  if (!await auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json() as { action: "start" | "stop" | "ack"; intervalMin?: number; focusMin?: number; cycle?: number };
    const cur  = await readState();

    if (body.action === "start") {
      if (cur.running) return NextResponse.json(cur);
      const iMin = typeof body.intervalMin === "number" && body.intervalMin >= 2
        ? Math.min(Math.floor(body.intervalMin), 120) : cur.interval_min;
      const fMin = typeof body.focusMin === "number" && body.focusMin >= 1
        ? Math.min(Math.floor(body.focusMin), iMin - 1) : Math.min(cur.focus_min, iMin - 1);
      const next: AlarmState = { running: true, started_at: new Date().toISOString(), interval_min: iMin, focus_min: Math.max(1, fMin), last_ack_cycle: -1 };
      await writeState(next);
      return NextResponse.json(next);
    }
    if (body.action === "stop") {
      if (!cur.running) return NextResponse.json(cur);
      const next = { ...cur, running: false, started_at: null };
      await writeState(next);
      return NextResponse.json(next);
    }
    if (body.action === "ack") {
      const cycle = typeof body.cycle === "number" ? Math.floor(body.cycle) : -1;
      if (cur.last_ack_cycle >= cycle) return NextResponse.json(cur);
      const next = { ...cur, last_ack_cycle: cycle };
      await writeState(next);
      return NextResponse.json(next);
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}
