import { NextResponse }               from "next/server";
import { auth }                       from "@/auth";
import { supabase, OPERATOR_USER_ID } from "@/lib/supabase";
import type { Session }               from "next-auth";

type AuthedSession = Session & { twoFactorVerified?: boolean };

function getAuthedSession(session: Session | null): AuthedSession | null {
  const s = session as AuthedSession | null;
  return s?.twoFactorVerified ? s : null;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function isValidIso(s: string): boolean {
  return ISO_RE.test(s) && !isNaN(Date.parse(s));
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
      return NextResponse.json({ error: "Failed to load comments." }, { status: 500 });
    }
    return NextResponse.json({ rows: data ?? [] });
  } catch (e) {
    console.error("[comments GET] unexpected", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
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
      trade_id?:  unknown;
      content:    unknown;
      created_at: unknown;
    };

    // content: required, non-empty, max 2000 chars
    if (typeof body.content !== "string" || !body.content.trim())
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    if (body.content.length > 2000)
      return NextResponse.json({ error: "content must be 2000 characters or fewer" }, { status: 400 });

    // trade_id: optional string, max 64 chars
    const tradeId = body.trade_id != null ? String(body.trade_id).slice(0, 64) : null;

    // created_at: required valid ISO 8601
    if (typeof body.created_at !== "string" || !isValidIso(body.created_at))
      return NextResponse.json({ error: "created_at must be a valid ISO 8601 timestamp" }, { status: 400 });

    const userId = OPERATOR_USER_ID
      ?? (authed.user as { id?: string } | undefined)?.id;

    const ts = body.created_at;

    const row: Record<string, unknown> = {
      trade_id:   tradeId,
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
      return NextResponse.json({ error: "Failed to save comment." }, { status: 500 });
    }
    if (!data) {
      console.error("[comments POST] insert returned no data");
      return NextResponse.json({ error: "Failed to save comment." }, { status: 500 });
    }

    return NextResponse.json({ row: data }, { status: 201 });
  } catch (e) {
    console.error("[comments POST] unexpected", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

/* DELETE — analyst can only remove analyst comments; operator comments are immutable */
export async function DELETE(req: Request) {
  try {
    const session = await auth() as Session | null;
    if (!getAuthedSession(session))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as { created_at?: unknown };
    const createdAt = body.created_at;

    if (typeof createdAt !== "string" || !isValidIso(createdAt))
      return NextResponse.json({ error: "created_at must be a valid ISO 8601 timestamp" }, { status: 400 });

    const { data: comment } = await supabase
      .from("comments")
      .select("content")
      .eq("Entry", createdAt)
      .single();

    if (!comment)
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });

    if (!comment.content.startsWith("Analyst comment:"))
      return NextResponse.json({ error: "Operator comments are immutable" }, { status: 403 });

    const { error } = await supabase.from("comments").delete().eq("Entry", createdAt);
    if (error) {
      console.error("[comments DELETE]", error);
      return NextResponse.json({ error: "Failed to delete comment." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[comments DELETE] unexpected", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
