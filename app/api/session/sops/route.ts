import { NextResponse }     from "next/server";
import { auth }             from "@/auth";
import { supabase }         from "@/lib/supabase";
import { validateSopInput } from "@/lib/sopValidation";
import type { Session }     from "next-auth";

type AuthedSession = Session & { twoFactorVerified?: boolean };

function getAuthedSession(session: Session | null): AuthedSession | null {
  const s = session as AuthedSession | null;
  return s?.twoFactorVerified ? s : null;
}

/* Whole SOP Builder feature lives on the strategist's Analytics page —
   list, create, update and delete are all gated the same way. */
const SOP_ROLES = ["strategist", "fund_manager"];

/* GET — list all SOP checklists, newest first. */
export async function GET() {
  try {
    const session = await auth() as Session | null;
    const authed  = getAuthedSession(session);
    if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const roles = authed.roles ?? [];
    if (!roles.some(r => SOP_ROLES.includes(r)))
      return NextResponse.json({ error: "Forbidden — strategist role required" }, { status: 403 });

    const { data, error } = await supabase
      .from("sop_checklists")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[sops GET]", error);
      return NextResponse.json({ error: "Failed to load SOP checklists." }, { status: 500 });
    }
    return NextResponse.json({ rows: data ?? [] });
  } catch (e) {
    console.error("[sops GET] unexpected", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

/* POST — create a new SOP checklist (1-12 rows, title, tags). */
export async function POST(req: Request) {
  try {
    const session = await auth() as Session | null;
    const authed  = getAuthedSession(session);
    if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const roles = authed.roles ?? [];
    if (!roles.some(r => SOP_ROLES.includes(r)))
      return NextResponse.json({ error: "Forbidden — strategist role required" }, { status: 403 });

    const body   = await req.json().catch(() => null);
    const result = validateSopInput(body);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    const { title, tags, items } = result.value;
    const { data, error } = await supabase
      .from("sop_checklists")
      .insert({ title, tags, items, created_by: authed.userEmail })
      .select()
      .single();

    if (error) {
      console.error("[sops POST] supabase error", error);
      return NextResponse.json({ error: "Failed to save SOP checklist." }, { status: 500 });
    }
    return NextResponse.json({ row: data }, { status: 201 });
  } catch (e) {
    console.error("[sops POST] unexpected", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
