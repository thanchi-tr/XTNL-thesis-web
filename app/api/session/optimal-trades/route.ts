import { NextResponse }               from "next/server";
import { auth }                       from "@/auth";
import { supabase, OPERATOR_USER_ID } from "@/lib/supabase";
import type { Session }               from "next-auth";

type AuthedSession = Session & { twoFactorVerified?: boolean };

function getAuthedSession(session: Session | null): AuthedSession | null {
  const s = session as AuthedSession | null;
  return s?.twoFactorVerified ? s : null;
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ rows: data ?? [] });
  } catch (e) {
    console.error("[optimal-trades GET] unexpected", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
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
      trade_id?:  string;
      result_r:   number;
      entry:      string;
      exit:       string;
      exempt_r?:  number;
      is_exempt?: boolean;
    };

    const userId = OPERATOR_USER_ID
      ?? (authed.user as { id?: string } | undefined)?.id;

    const row: Record<string, unknown> = {
      trade_id:   body.trade_id || null,
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Insert returned no data — check table name and RLS" }, { status: 500 });
    }

    /* Insert exempt records if flagged — one exempt_r row + one exempt_count row */
    if (body.is_exempt && body.exempt_r !== undefined && body.exempt_r !== 0) {
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
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/* DELETE — remove a trade and its exempts */
export async function DELETE(req: Request) {
  try {
    const session = await auth() as Session | null;
    if (!getAuthedSession(session))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await req.json() as { id: string };
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    /* Remove related exempts first (FK constraint) */
    await supabase.from("exempts").delete().eq("optimal_trade_id", id);

    const { error } = await supabase
      .from("theoretical_optimal_trades")
      .delete()
      .eq("optimal_trade_id", id);

    if (error) {
      console.error("[optimal-trades DELETE]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[optimal-trades DELETE] unexpected", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
