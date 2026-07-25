import { NextResponse }               from "next/server";
import { auth }                       from "@/auth";
import { supabase, OPERATOR_USER_ID } from "@/lib/supabase";
import type { Session }               from "next-auth";

type AuthedSession = Session & { twoFactorVerified?: boolean };

function authed(session: Session | null): boolean {
  return !!(session as AuthedSession | null)?.twoFactorVerified;
}

/** Monday of the current week in Melbourne time (YYYY-MM-DD) — the week key. */
function getMondayKey(): string {
  const md       = new Date(new Date().toLocaleString("en-US", { timeZone: "Australia/Melbourne" }));
  const daysBack = md.getDay() === 0 ? 6 : md.getDay() - 1;
  const monday   = new Date(md);
  monday.setDate(md.getDate() - daysBack);
  return [
    monday.getFullYear(),
    String(monday.getMonth() + 1).padStart(2, "0"),
    String(monday.getDate()).padStart(2, "0"),
  ].join("-");
}

const PREFIX = "analysis_session:";

/* Team-wide pipeline step, not per-user progress — the key is week-only so
   whichever analyst/strategist clicks it first marks it done for everyone
   that week, matching the other two steps (Ingestion/Process) which are
   also system-wide states rather than per-user ones. */
function weekKey(): string {
  return `${PREFIX}${getMondayKey()}:done`;
}

/** GET — returns { done: boolean } for the current week. */
export async function GET() {
  try {
    const session = await auth();
    if (!authed(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data } = await supabase.from("comments")
      .select("Entry").eq("content", weekKey()).limit(1).single();

    return NextResponse.json({ done: !!data });
  } catch {
    return NextResponse.json({ done: false });
  }
}

/** POST — idempotently marks this week's analysis session as done. */
export async function POST() {
  try {
    const session = await auth();
    if (!authed(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const key = weekKey();
    const { data } = await supabase.from("comments")
      .select("Entry").eq("content", key).limit(1).single();
    if (data) return NextResponse.json({ done: true });

    const now = new Date().toISOString();
    const row: Record<string, unknown> = {
      content:    key,
      created_at: now,
      Entry:      now,
    };
    if (OPERATOR_USER_ID) row.user_id = OPERATOR_USER_ID;

    const { error } = await supabase.from("comments").insert(row);
    if (error) {
      console.error("[analysis-session POST] supabase error", error);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }
    return NextResponse.json({ done: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
