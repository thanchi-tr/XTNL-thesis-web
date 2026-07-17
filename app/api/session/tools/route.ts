import { NextResponse, type NextRequest } from "next/server";
import { auth }      from "@/auth";
import { supabase }  from "@/lib/supabase";

const TOOL_CATEGORIES = ["friction", "firmware", "protocol", "hardware", "biometric"] as const;

/** GET — Digital Tool catalog with aggregated efficacy telemetry.
 *  Effectiveness = deployments that have never triggered a relapse / total
 *  deployments. A tool deployed against many issues over years accrues (or
 *  bleeds) trust through this single number.                                */
export async function GET() {
  const session = await auth();
  if (!session?.twoFactorVerified)
    return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const [{ data: tools, error: tErr }, { data: deps, error: dErr }] = await Promise.all([
    supabase.from("digital_tools").select("*").order("created_at", { ascending: false }),
    supabase.from("tool_deployments").select("tool_id, issue_id, active, relapses, deployed_at"),
  ]);

  if (tErr) {
    // Table missing until migration runs — return an explicit empty catalog.
    return NextResponse.json({ tools: [], migrated: false });
  }
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

  const byTool = new Map<string, { total: number; relapsed: number; active: number }>();
  for (const d of deps ?? []) {
    const s = byTool.get(d.tool_id) ?? { total: 0, relapsed: 0, active: 0 };
    s.total   += 1;
    s.relapsed += (d.relapses ?? 0) > 0 ? 1 : 0;
    s.active  += d.active ? 1 : 0;
    byTool.set(d.tool_id, s);
  }

  const out = (tools ?? []).map(t => {
    const s = byTool.get(t.tool_id) ?? { total: 0, relapsed: 0, active: 0 };
    return {
      tool_id:      t.tool_id,
      name:         t.name,
      category:     t.category,
      blueprint:    t.blueprint,
      version:      t.version,
      created_by:   t.created_by,
      created_at:   t.created_at,
      deprecated:   t.deprecated,
      deployments:  s.total,
      active_deployments: s.active,
      relapsed_deployments: s.relapsed,
      effectiveness: s.total > 0 ? Math.round(((s.total - s.relapsed) / s.total) * 1000) / 10 : null,
    };
  });

  return NextResponse.json({ tools: out, migrated: true });
}

/** POST — register a new Digital Tool (Strategist / Fund Manager only). */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.twoFactorVerified)
    return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const roles: string[] = (session as any).roles ?? [];
  if (!roles.some(r => ["strategist", "fund_manager"].includes(r)))
    return NextResponse.json({ error: "Strategist role required" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name      = typeof body.name      === "string" ? body.name.trim().slice(0, 120)       : "";
  const blueprint = typeof body.blueprint === "string" ? body.blueprint.trim().slice(0, 3000) : "";
  const version   = typeof body.version   === "string" && body.version.trim()
    ? body.version.trim().slice(0, 20) : "v1.0";
  const category  = (TOOL_CATEGORIES as readonly string[]).includes(body.category)
    ? body.category : null;

  if (!name)      return NextResponse.json({ error: "Tool name required" }, { status: 400 });
  if (!category)  return NextResponse.json({ error: "Valid tool category required" }, { status: 422 });
  if (!blueprint) return NextResponse.json({ error: "Implementation blueprint required" }, { status: 400 });

  const { data, error } = await supabase
    .from("digital_tools")
    .insert({ name, category, blueprint, version, created_by: (session as any).userEmail ?? "unknown" })
    .select("tool_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tool_id: data.tool_id }, { status: 201 });
}
