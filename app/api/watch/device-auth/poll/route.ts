import { NextResponse, type NextRequest } from "next/server";
import { supabase }                       from "@/lib/supabase";

/* Device codes are generated as "XTNL-" + 6 chars from CODE_CHARS
   (A-Z minus I/O + 2-9). Reject anything that doesn't match before
   touching the database — prevents injection probing via the code param. */
const CODE_RE = /^XTNL-[A-HJ-NP-Z2-9]{6}$/;

/** GET ?code=XTNL-XXXXXX — watch polls until authorized or expired */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code || !CODE_RE.test(code)) {
    return NextResponse.json({ status: "expired" });
  }

  const { data, error } = await supabase
    .from("watch_device_codes")
    .select("status, token, token_expires_at, expires_at")
    .eq("device_code", code)
    .single();

  if (error || !data) return NextResponse.json({ status: "expired" });
  if (Date.now() > new Date(data.expires_at as string).getTime()) return NextResponse.json({ status: "expired" });

  if (data.status === "authorized" && data.token) {
    return NextResponse.json({
      status:    "authorized",
      token:     data.token,
      expiresAt: data.token_expires_at,
    });
  }

  return NextResponse.json({ status: "pending" });
}
