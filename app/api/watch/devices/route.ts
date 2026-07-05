/**
 * Browser-authenticated endpoint — list all registered (non-dropped) watches.
 * GET /api/watch/devices
 */
import { NextResponse }  from "next/server";
import { auth }          from "@/auth";
import { supabase }      from "@/lib/supabase";
import type { Session }  from "next-auth";

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

const PREFIX = "watch_devices:";

async function readDevices(): Promise<DeviceRecord[]> {
  const { data } = await supabase
    .from("comments").select("content")
    .like("content", `${PREFIX}%`)
    .order("Entry", { ascending: false }).limit(1).single();
  if (!data) return [];
  try { return JSON.parse(data.content.slice(PREFIX.length)) as DeviceRecord[]; }
  catch { return []; }
}

export async function GET() {
  const session = await auth() as Session | null;
  if (!authed(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const devices = await readDevices();
  return NextResponse.json(devices.filter(d => !d.dropped));
}
