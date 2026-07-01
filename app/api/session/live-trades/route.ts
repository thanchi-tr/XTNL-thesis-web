import { NextResponse } from "next/server";
import { auth }         from "@/auth";
import { supabase }     from "@/lib/supabase";
import type { Session } from "next-auth";

type AuthedSession = Session & { twoFactorVerified?: boolean };

/* GET — trades with incomplete SOP flags */
export async function GET() {
  try {
    const session = await auth() as Session | null;
    const s = session as AuthedSession | null;
    if (!s?.twoFactorVerified)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("trades")
      .select("*")
      .or("cor_lock.is.null,cor_dir.is.null,cor_target.is.null,cor_entry.is.null,cor_rm.is.null")
      .order("entry", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[live-trades GET]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ rows: data ?? [] });
  } catch (e) {
    console.error("[live-trades GET] unexpected", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
