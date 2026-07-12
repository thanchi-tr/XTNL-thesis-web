/**
 * Watch device registration and drop-status check.
 * Both endpoints use Bearer JWT (watch token) auth.
 *
 * POST — watch registers/re-registers itself after successful QR auth
 * GET  — watch polls to check if it has been dropped by the operator
 */
import { NextResponse }     from "next/server";
import { supabase }         from "@/lib/supabase";
import { verifyWatchToken } from "@/lib/watchJwt";

async function authWatch(req: Request): Promise<boolean> {
  const header = req.headers.get("Authorization") ?? "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return false;
  return (await verifyWatchToken(token)) !== null;
}

/** POST — called by the watch after successful QR auth to register/refresh the device */
export async function POST(req: Request) {
  if (!await authWatch(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { deviceId?: string; deviceName?: string };
  if (!body.deviceId) return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });

  const { error } = await supabase.from("watch_devices").upsert(
    {
      device_id:    body.deviceId,
      device_name:  body.deviceName ?? "Galaxy Watch",
      dropped:      false,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "device_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** GET ?deviceId=... — watch polls to detect if it has been dropped by the operator */
export async function GET(req: Request) {
  if (!await authWatch(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deviceId = new URL(req.url).searchParams.get("deviceId");
  if (!deviceId) return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });

  const { data } = await supabase
    .from("watch_devices")
    .select("dropped")
    .eq("device_id", deviceId)
    .single();

  // Fire-and-forget last_seen_at update
  void supabase
    .from("watch_devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("device_id", deviceId);

  return NextResponse.json({ dropped: data?.dropped ?? false });
}
