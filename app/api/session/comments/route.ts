import { NextResponse }               from "next/server";
import { auth }                       from "@/auth";
import { supabase, OPERATOR_USER_ID } from "@/lib/supabase";
import type { Session }               from "next-auth";

type AuthedSession = Session & { twoFactorVerified?: boolean };

function getAuthedSession(session: Session | null): AuthedSession | null {
  const s = session as AuthedSession | null;
  return s?.twoFactorVerified ? s : null;
}

/* GET — comments newest first */
export async function GET() {
  try {
    const session = await auth() as Session | null;
    if (!getAuthedSession(session))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .gte("Entry", cutoff)
      .order("Entry", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[comments GET]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ rows: data ?? [] });
  } catch (e) {
    console.error("[comments GET] unexpected", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/* POST — insert a comment */
export async function POST(req: Request) {
  try {
    const session = await auth() as Session | null;
    const authed  = getAuthedSession(session);
    if (!authed)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as {
      trade_id?:  string;
      content:    string;
      created_at: string;
    };

    if (!body.content?.trim())
      return NextResponse.json({ error: "content is required" }, { status: 400 });

    /* Prefer session user ID → env-var fallback → omit (if column is nullable) */
    const userId = OPERATOR_USER_ID
      ?? (authed.user as { id?: string } | undefined)?.id;

    const ts = body.created_at;

    const row: Record<string, unknown> = {
      trade_id:   body.trade_id || null,
      content:    body.content.trim(),
      created_at: ts,
      Entry:      ts,
    };
    if (userId) row.user_id = userId;

    const { data, error } = await supabase
      .from("comments")
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error("[comments POST] supabase error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Insert returned no data — check table name and RLS" }, { status: 500 });
    }

    return NextResponse.json({ row: data }, { status: 201 });
  } catch (e) {
    console.error("[comments POST] unexpected", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/* DELETE — analyst can only remove analyst comments; operator comments are immutable */
export async function DELETE(req: Request) {
  try {
    const session = await auth() as Session | null;
    if (!getAuthedSession(session))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { created_at } = await req.json() as { created_at: string };
    if (!created_at) return NextResponse.json({ error: "created_at required" }, { status: 400 });

    const { data: comment } = await supabase
      .from("comments")
      .select("content")
      .eq("Entry", created_at)
      .single();

    if (!comment)
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });

    if (!comment.content.startsWith("Analyst comment:"))
      return NextResponse.json({ error: "Operator comments are immutable" }, { status: 403 });

    const { error } = await supabase.from("comments").delete().eq("Entry", created_at);
    if (error) {
      console.error("[comments DELETE]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[comments DELETE] unexpected", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
