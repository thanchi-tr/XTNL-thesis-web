/**
 * Browser-authenticated endpoint — drop a specific registered watch.
 * DELETE /api/watch/devices/[deviceId]
 *
 * Marks the device as dropped=true. The watch detects this on its next
 * status poll and returns to the authentication screen.
 */
import { NextResponse }           from "next/server";
import { auth }                   from "@/auth";
import { supabase, OPERATOR_USER_ID } from "@/lib/supabase";
import type { Session }           from "next-auth";

type AuthedSession = Session & { twoFactorVerified?: boolean };
function authed(session: Session | null): boolean {
  return !!(session as AuthedSession | null)?.twoFactorVerified;
}

type DeviceRecord = {
  deviceId:     string;
  deviceName:   string;
  registeredAt: string;
  dropped:      boolean;
};

const PREFIX = "watch_devices:";

async function readDevices(): Promise<{ Entry: string | null; devices: DeviceRecord[] }> {
  const { data } = await supabase
    .from("comments").select("content, Entry")
    .like("content", `${PREFIX}%`)
    .order("Entry", { ascending: false }).limit(1).single();
  if (!data) return { Entry: null, devices: [] };
  try {
    return { Entry: data.Entry as string, devices: JSON.parse(data.content.slice(PREFIX.length)) as DeviceRecord[] };
  } catch { return { Entry: data.Entry as string, devices: [] }; }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const session = await auth() as Session | null;
  if (!authed(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { deviceId } = await params;
  const { Entry, devices } = await readDevices();
  if (!Entry) return NextResponse.json({ error: "No devices registered" }, { status: 404 });

  const idx = devices.findIndex(d => d.deviceId === deviceId);
  if (idx < 0) return NextResponse.json({ error: "Device not found" }, { status: 404 });

  devices[idx] = { ...devices[idx], dropped: true };
  const content = PREFIX + JSON.stringify(devices);
  await supabase.from("comments").update({ content }).eq("Entry", Entry);

  return NextResponse.json({ ok: true });
}
