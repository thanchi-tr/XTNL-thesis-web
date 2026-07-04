import { NextResponse }            from "next/server";
import { supabase, OPERATOR_USER_ID } from "@/lib/supabase";

const PREFIX     = "watch_device:";
const TTL_MS     = 10 * 60 * 1000; // 10 minutes
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

function genCode(len = 6) {
  return Array.from({ length: len }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join("");
}

/** POST — watch requests a device code and gets back a QR URL */
export async function POST() {
  const userCode   = genCode();
  const deviceCode = `XTNL-${userCode}`;
  const expiresMs  = Date.now() + TTL_MS;
  const verifyUrl  = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/watch-auth?code=${encodeURIComponent(deviceCode)}`;

  const payload = { deviceCode, userCode, verifyUrl, expiresMs, status: "pending", token: null, tokenExpiresAt: null };
  const now     = new Date().toISOString();

  const { error } = await supabase.from("comments").insert({
    content:    PREFIX + JSON.stringify(payload),
    created_at: now,
    Entry:      now,
    user_id:    OPERATOR_USER_ID,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deviceCode, userCode, verifyUrl, expiresIn: TTL_MS / 1000 });
}
