import { NextResponse }       from "next/server";
import { auth }               from "@/auth";
import { supabase, OPERATOR_USER_ID } from "@/lib/supabase";
import { signWatchToken }     from "@/lib/watchJwt";
import type { Session }       from "next-auth";

const PREFIX         = "watch_device:";
const DEVICES_PREFIX = "watch_devices:";

type DeviceRecord = {
  deviceId:     string;
  deviceName:   string;
  registeredAt: string;
  dropped:      boolean;
};

/** POST { deviceCode } — called by the phone /watch-auth page after the user confirms */
export async function POST(req: Request) {
  const session = await auth() as (Session & { twoFactorVerified?: boolean }) | null;
  if (!session?.twoFactorVerified)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { deviceCode } = await req.json() as { deviceCode?: string };
  if (!deviceCode) return NextResponse.json({ error: "Missing deviceCode" }, { status: 400 });

  // ── Find the pending watch_device: record ─────────────────────────────
  const { data } = await supabase
    .from("comments")
    .select("content, Entry")
    .like("content", `${PREFIX}%`)
    .order("Entry", { ascending: false })
    .limit(100);

  type Row = { content: string; Entry: string };
  const rows = (data as Row[] ?? []).map(r => ({
    Entry:  r.Entry,
    parsed: (() => { try { return JSON.parse(r.content.slice(PREFIX.length)); } catch { return null; } })(),
  }));

  const row = rows.find(r => r.parsed?.deviceCode === deviceCode);
  if (!row?.parsed)              return NextResponse.json({ error: "Device code not found" }, { status: 404 });
  if (Date.now() > row.parsed.expiresMs) return NextResponse.json({ error: "QR code expired" }, { status: 410 });
  if (row.parsed.status === "authorized") return NextResponse.json({ ok: true }); // idempotent

  const userId = (session.user as { id?: string } | undefined)?.id ?? "operator";
  let token: string;
  let tokenExpiresAt: string;
  try {
    const signed = await signWatchToken(userId);
    token        = signed.token;
    tokenExpiresAt = signed.expiresAt;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[watch authorize] signWatchToken failed:", msg);
    return NextResponse.json(
      { error: "Token generation failed", detail: msg },
      { status: 500 }
    );
  }

  // ── Update the watch_device: record with the signed token ─────────────
  const updated = { ...row.parsed, status: "authorized", token, tokenExpiresAt };
  const { error: updateError } = await supabase
    .from("comments")
    .update({ content: PREFIX + JSON.stringify(updated) })
    .eq("Entry", row.Entry);

  if (updateError) {
    console.error("[watch authorize] Supabase update failed:", updateError);
    return NextResponse.json({ error: "Failed to store token — database error" }, { status: 500 });
  }

  // ── Server-side device registration (so Connected Devices shows immediately) ──
  // If the watch sent deviceId/deviceName in the initial QR request, use them.
  const deviceId   = row.parsed.deviceId   as string | undefined;
  const deviceName = row.parsed.deviceName as string | undefined;

  if (deviceId) {
    // Read existing devices list
    const { data: devData } = await supabase
      .from("comments").select("content, Entry")
      .like("content", `${DEVICES_PREFIX}%`)
      .order("Entry", { ascending: false }).limit(1).single();

    let existingEntry: string | null = null;
    let devices: DeviceRecord[] = [];
    if (devData) {
      existingEntry = devData.Entry as string;
      try { devices = JSON.parse(devData.content.slice(DEVICES_PREFIX.length)) as DeviceRecord[]; } catch { /* ignore */ }
    }

    const now = new Date().toISOString();
    const idx = devices.findIndex(d => d.deviceId === deviceId);
    if (idx >= 0) {
      devices[idx] = { ...devices[idx], deviceName: deviceName ?? devices[idx].deviceName, dropped: false };
    } else {
      devices.push({ deviceId, deviceName: deviceName ?? "Galaxy Watch", registeredAt: now, dropped: false });
    }

    const devContent = DEVICES_PREFIX + JSON.stringify(devices);
    if (existingEntry) {
      await supabase.from("comments").update({ content: devContent }).eq("Entry", existingEntry);
    } else {
      await supabase.from("comments").insert({ content: devContent, created_at: now, Entry: now, user_id: OPERATOR_USER_ID });
    }
  }

  return NextResponse.json({ ok: true });
}
