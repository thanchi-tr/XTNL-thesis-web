/**
 * Watch device registration and drop-status check.
 * Both endpoints use Bearer JWT (watch token) auth.
 *
 * POST — watch registers/re-registers itself after successful auth
 * GET  — watch polls to check if it has been dropped by the operator
 */
import { NextResponse }           from "next/server";
import { supabase, OPERATOR_USER_ID } from "@/lib/supabase";
import { verifyWatchToken }       from "@/lib/watchJwt";

type DeviceRecord = {
  deviceId:     string;
  deviceName:   string;
  registeredAt: string;
  dropped:      boolean;
};

const PREFIX = "watch_devices:";

async function authWatch(req: Request): Promise<boolean> {
  const header = req.headers.get("Authorization") ?? "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return false;
  return (await verifyWatchToken(token)) !== null;
}

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

async function writeDevices(devices: DeviceRecord[], existingEntry: string | null): Promise<void> {
  const content = PREFIX + JSON.stringify(devices);
  if (existingEntry) {
    await supabase.from("comments").update({ content }).eq("Entry", existingEntry);
  } else {
    const now = new Date().toISOString();
    await supabase.from("comments").insert({ content, created_at: now, Entry: now, user_id: OPERATOR_USER_ID });
  }
}

/** POST — called by the watch after successful QR auth to register/refresh the device */
export async function POST(req: Request) {
  if (!await authWatch(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { deviceId?: string; deviceName?: string };
  if (!body.deviceId) return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });

  const { Entry, devices } = await readDevices();
  const now = new Date().toISOString();
  const idx = devices.findIndex(d => d.deviceId === body.deviceId);

  if (idx >= 0) {
    // Re-registration always clears dropped status and refreshes name
    devices[idx] = {
      ...devices[idx],
      deviceName: body.deviceName ?? devices[idx].deviceName,
      dropped:    false,
    };
  } else {
    devices.push({
      deviceId:     body.deviceId,
      deviceName:   body.deviceName ?? "Galaxy Watch",
      registeredAt: now,
      dropped:      false,
    });
  }

  await writeDevices(devices, Entry);
  return NextResponse.json({ ok: true });
}

/** GET ?deviceId=... — watch polls to detect if it has been dropped by the operator */
export async function GET(req: Request) {
  if (!await authWatch(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deviceId = new URL(req.url).searchParams.get("deviceId");
  if (!deviceId) return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });

  const { devices } = await readDevices();
  const device = devices.find(d => d.deviceId === deviceId);
  return NextResponse.json({ dropped: device?.dropped ?? false });
}
