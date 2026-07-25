import { NextResponse, type NextRequest } from "next/server";
import { auth }             from "@/auth";
import { supabase }         from "@/lib/supabase";
import { validateSopInput } from "@/lib/sopValidation";
import type { Session }     from "next-auth";

type AuthedSession = Session & { twoFactorVerified?: boolean };

function getAuthedSession(session: Session | null): AuthedSession | null {
  const s = session as AuthedSession | null;
  return s?.twoFactorVerified ? s : null;
}

const SOP_ROLES = ["strategist", "fund_manager"];

/* PUT — update an existing SOP checklist's title/tags/items. */
export async function PUT(
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

    const body   = await req.json().catch(() => null);
    const result = validateSopInput(body);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    const { title, tags, items } = result.value;
    const { data, error } = await supabase
      .from("sop_checklists")
      .update({ title, tags, items, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[sops PUT] supabase error", error);
      return NextResponse.json({ error: "Failed to update SOP checklist." }, { status: 500 });
    }
    return NextResponse.json({ row: data });
  } catch (e) {
    console.error("[sops PUT] unexpected", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

/* DELETE — remove a SOP checklist permanently. */
export async function DELETE(
  _req: NextRequest,
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

    const { error } = await supabase.from("sop_checklists").delete().eq("id", id);
    if (error) {
      console.error("[sops DELETE] supabase error", error);
      return NextResponse.json({ error: "Failed to delete SOP checklist." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[sops DELETE] unexpected", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
