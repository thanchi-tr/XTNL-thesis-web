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

function isFiniteInRange(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && isFinite(v) && v >= min && v <= max;
}

/* GET — optimal trades, newest first */
export async function GET() {
  try {
    const session = await auth() as Session | null;
    if (!getAuthedSession(session))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("theoretical_optimal_trades")
      .select("*")
      .gte("entry", cutoff)
      .order("entry", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[optimal-trades GET]", error);
      return NextResponse.json({ error: "Failed to load trades." }, { status: 500 });
    }
    return NextResponse.json({ rows: data ?? [] });
  } catch (e) {
    console.error("[optimal-trades GET] unexpected", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

/* POST — insert a new optimal trade */
export async function POST(req: Request) {
  try {
    const session = await auth() as Session | null;
    const authed  = getAuthedSession(session);
    if (!authed)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as {
      trade_id?:  unknown;
      result_r:   unknown;
      entry:      unknown;
      exit:       unknown;
      exempt_r?:  unknown;
      is_exempt?: unknown;
    };

    // result_r: required finite number in [-50, 50]
    if (!isFiniteInRange(body.result_r, -50, 50))
      return NextResponse.json({ error: "result_r must be a number between -50 and 50" }, { status: 400 });

    // entry: required valid ISO 8601
    if (typeof body.entry !== "string" || !isValidIso(body.entry))
      return NextResponse.json({ error: "entry must be a valid ISO 8601 timestamp" }, { status: 400 });

    // exit: required valid ISO 8601
    if (typeof body.exit !== "string" || !isValidIso(body.exit))
      return NextResponse.json({ error: "exit must be a valid ISO 8601 timestamp" }, { status: 400 });

    // trade_id: optional string, max 64 chars
    const tradeId = body.trade_id != null ? String(body.trade_id).slice(0, 64) : null;

    const userId = OPERATOR_USER_ID
      ?? (authed.user as { id?: string } | undefined)?.id;

    const row: Record<string, unknown> = {
      trade_id:   tradeId,
      result_r:   body.result_r,
      entry:      body.entry,
      exit:       body.exit,
      created_at: new Date().toISOString(),
    };
    if (userId) row.user_id = userId;

    const { data, error } = await supabase
      .from("theoretical_optimal_trades")
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error("[optimal-trades POST] supabase error", error);
      return NextResponse.json({ error: "Failed to save trade." }, { status: 500 });
    }
    if (!data) {
      console.error("[optimal-trades POST] insert returned no data");
      return NextResponse.json({ error: "Failed to save trade." }, { status: 500 });
    }

    /* Insert exempt records if flagged */
    const isExempt = body.is_exempt === true;
    if (isExempt && isFiniteInRange(body.exempt_r, -50, 50) && body.exempt_r !== 0) {
      const today = new Date().toISOString().split("T")[0];
      const base  = (extra: object): Record<string, unknown> => ({
        optimal_trade_id: data.optimal_trade_id,
        created_at:       today,
        ...(userId ? { user_id: userId } : {}),
        ...extra,
      });
      const { error: ee } = await supabase.from("exempts").insert([
        base({ value: body.exempt_r, type: "exempt_r"    }),
        base({ value: 1,             type: "exempt_count" }),
      ]);
      if (ee) console.error("[optimal-trades POST] exempt insert error", ee);
    }

    return NextResponse.json({ row: data }, { status: 201 });
  } catch (e) {
    console.error("[optimal-trades POST] unexpected", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

/* DELETE — remove a trade and its exempts */
export async function DELETE(req: Request) {
  try {
    const session = await auth() as Session | null;
    if (!getAuthedSession(session))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as { id?: unknown };
    if (typeof body.id !== "string" || !body.id)
      return NextResponse.json({ error: "id required" }, { status: 400 });

    /* Remove related exempts first (FK constraint) */
    await supabase.from("exempts").delete().eq("optimal_trade_id", body.id);

    const { error } = await supabase
      .from("theoretical_optimal_trades")
      .delete()
      .eq("optimal_trade_id", body.id);

    if (error) {
      console.error("[optimal-trades DELETE]", error);
      return NextResponse.json({ error: "Failed to delete trade." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[optimal-trades DELETE] unexpected", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
