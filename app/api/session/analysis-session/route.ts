import { NextResponse } from "next/server";
import { auth }         from "@/auth";
import { supabase }     from "@/lib/supabase";
import type { Session } from "next-auth";

type AuthedSession = Session & { twoFactorVerified?: boolean };

function authed(session: Session | null): boolean {
  return !!(session as AuthedSession | null)?.twoFactorVerified;
}

function getUserId(session: Session): string | null {
  return ((session.user) as { id?: string } | undefined)?.id ?? null;
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

/** GET — returns { done: boolean } for the current week + user. */
export async function GET() {
  try {
    const session = await auth();
    if (!authed(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = getUserId(session!);
    if (!userId) return NextResponse.json({ done: false });

    const key      = `${PREFIX}${getMondayKey()}:${userId}:done`;
    const { data } = await supabase.from("comments")
      .select("Entry").eq("content", key).limit(1).single();

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
    const userId = getUserId(session!);
    if (!userId) return NextResponse.json({ error: "No user" }, { status: 400 });

    const key      = `${PREFIX}${getMondayKey()}:${userId}:done`;
    const { data } = await supabase.from("comments")
      .select("Entry").eq("content", key).limit(1).single();
    if (data) return NextResponse.json({ done: true });

    const now = new Date().toISOString();
    await supabase.from("comments").insert({
      content:    key,
      created_at: now,
      Entry:      now,
      user_id:    userId,
    });
    return NextResponse.json({ done: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
