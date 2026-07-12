/**
 * Browser-authenticated endpoint — drop a specific registered watch.
 * DELETE /api/watch/devices/[deviceId]
 *
 * Marks the device as dropped=true. The watch detects this on its next
 * status poll and returns to the authentication screen.
 */
import { NextResponse } from "next/server";
import { auth }         from "@/auth";
import { supabase }     from "@/lib/supabase";
import type { Session } from "next-auth";

type AuthedSession = Session & { twoFactorVerified?: boolean };
function authed(session: Session | null): boolean {
  return !!(session as AuthedSession | null)?.twoFactorVerified;
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const session = await auth() as Session | null;
  if (!authed(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { deviceId } = await params;

  const { error } = await supabase
    .from("watch_devices")
    .update({ dropped: true })
    .eq("device_id", deviceId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
