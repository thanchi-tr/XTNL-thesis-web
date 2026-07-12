import { NextResponse }   from "next/server";
import { auth }           from "@/auth";
import { supabase }       from "@/lib/supabase";
import { signWatchToken } from "@/lib/watchJwt";
import type { Session }   from "next-auth";

const CODE_RE = /^XTNL-[A-HJ-NP-Z2-9]{6}$/;

/** POST { deviceCode } — called by the phone /watch-auth page after the user confirms */
export async function POST(req: Request) {
  const session = await auth() as (Session & { twoFactorVerified?: boolean }) | null;
  if (!session?.twoFactorVerified)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { deviceCode } = await req.json() as { deviceCode?: string };
  if (!deviceCode || !CODE_RE.test(deviceCode))
    return NextResponse.json({ error: "Invalid device code format" }, { status: 400 });

  // Find the pending code record
  const { data: codeRow, error: findErr } = await supabase
    .from("watch_device_codes")
    .select("*")
    .eq("device_code", deviceCode)
    .single();

  if (findErr || !codeRow)
    return NextResponse.json({ error: "Device code not found" }, { status: 404 });
  if (Date.now() > new Date(codeRow.expires_at as string).getTime())
    return NextResponse.json({ error: "QR code expired" }, { status: 410 });
  if (codeRow.status === "authorized")
    return NextResponse.json({ ok: true }); // idempotent

  // Sign the watch token
  const userId = (session.user as { id?: string } | undefined)?.id ?? "operator";
  let token: string;
  let tokenExpiresAt: string;
  try {
    const signed = await signWatchToken(userId);
    token          = signed.token;
    tokenExpiresAt = signed.expiresAt;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[watch authorize] signWatchToken failed:", msg);
    return NextResponse.json({ error: "Token generation failed", detail: msg }, { status: 500 });
  }

  // Update the code record to authorized
  const { error: updateErr } = await supabase
    .from("watch_device_codes")
    .update({ status: "authorized", token, token_expires_at: tokenExpiresAt })
    .eq("device_code", deviceCode);

  if (updateErr) {
    console.error("[watch authorize] update failed:", updateErr);
    return NextResponse.json({ error: "Failed to authorize — database error" }, { status: 500 });
  }

  // Upsert device into watch_devices so Connected Devices shows it immediately
  const deviceId   = codeRow.device_id   as string | null;
  const deviceName = codeRow.device_name as string | null;

  if (deviceId) {
    await supabase.from("watch_devices").upsert(
      {
        device_id:    deviceId,
        device_name:  deviceName ?? "Galaxy Watch",
        dropped:      false,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "device_id" }
    );
  }

  return NextResponse.json({ ok: true });
}
