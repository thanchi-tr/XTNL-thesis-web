import { NextResponse, type NextRequest } from "next/server";
import { auth }      from "@/auth";
import { supabase }  from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.twoFactorVerified)
    return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const { data, error } = await supabase
    .from("issues_view")
    .select("*");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.twoFactorVerified)
    return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const roles: string[] = (session as any).roles ?? [];
  if (!roles.some(r => ["operator", "analyst", "strategist", "fund_manager"].includes(r)))
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const title       = typeof body.title       === "string" ? body.title.trim().slice(0, 200)       : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 2000) : null;
  const priority    = typeof body.priority    === "number"
    ? Math.max(0, Math.min(5, Math.round(body.priority)))
    : 3;

  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const reported_by   = (session as any).userEmail ?? "unknown";
  const reporter_role = roles[0] ?? null;

  const { data, error } = await supabase
    .from("issues")
    .insert({ title, description, reported_by, reporter_role, priority })
    .select("issue_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ issue_id: data.issue_id }, { status: 201 });
}
