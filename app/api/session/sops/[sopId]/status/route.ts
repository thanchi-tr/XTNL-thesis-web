import { NextResponse, type NextRequest } from "next/server";
import { auth }     from "@/auth";
import { supabase } from "@/lib/supabase";
import type { Session } from "next-auth";

type AuthedSession = Session & { twoFactorVerified?: boolean };

function getAuthedSession(session: Session | null): AuthedSession | null {
  const s = session as AuthedSession | null;
  return s?.twoFactorVerified ? s : null;
}

const SOP_ROLES = ["strategist", "fund_manager"];

/* PATCH — archive or reactivate a SOP checklist. Lightweight: doesn't touch
   title/tags/items, unlike the full PUT on the parent route. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sopId: string }> }
) {
  try {
    const session = await auth() as Session | null;
    const authed  = getAuthedSession(session);
    if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const roles = authed.roles ?? [];
    if (!roles.some(r => SOP_ROLES.includes(r)))
      return NextResponse.json({ error: "Forbidden — strategist role required" }, { status: 403 });

    const { sopId } = await params;
    const id = Number(sopId);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await req.json().catch(() => null) as { status?: unknown } | null;
    const status = body?.status;
    if (status !== "active" && status !== "archived")
      return NextResponse.json({ error: 'status must be "active" or "archived"' }, { status: 400 });

    const { data, error } = await supabase
      .from("sop_checklists")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[sops status PATCH] supabase error", error);
      return NextResponse.json({ error: "Failed to update status." }, { status: 500 });
    }
    return NextResponse.json({ row: data });
  } catch (e) {
    console.error("[sops status PATCH] unexpected", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
