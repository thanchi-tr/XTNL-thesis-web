/**
 * Browser-authenticated endpoint — list all registered (non-dropped) watches.
 * GET /api/watch/devices
 */
import { NextResponse } from "next/server";
import { auth }         from "@/auth";
import { supabase }     from "@/lib/supabase";
import type { Session } from "next-auth";

type AuthedSession = Session & { twoFactorVerified?: boolean };
function authed(session: Session | null): boolean {
  return !!(session as AuthedSession | null)?.twoFactorVerified;
}

export type DeviceRecord = {
  deviceId:     string;
  deviceName:   string;
  registeredAt: string;
  dropped:      boolean;
};

export async function GET() {
  const session = await auth() as Session | null;
  if (!authed(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("watch_devices")
    .select("device_id, device_name, registered_at, dropped")
    .eq("dropped", false)
    .order("registered_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const devices: DeviceRecord[] = (data ?? []).map(d => ({
    deviceId:     d.device_id as string,
    deviceName:   d.device_name as string,
    registeredAt: d.registered_at as string,
    dropped:      d.dropped as boolean,
  }));

  return NextResponse.json(devices);
}
