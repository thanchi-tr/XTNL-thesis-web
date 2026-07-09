import { NextResponse, type NextRequest } from "next/server";
import { supabase }                       from "@/lib/supabase";

const PREFIX = "watch_device:";

/* Device codes are generated as "XTNL-" + 6 chars from CODE_CHARS
   (A-Z minus I/O + 2-9). Reject anything that doesn't match before
   touching the database — prevents injection probing via the code param. */
const CODE_RE = /^XTNL-[A-HJ-NP-Z2-9]{6}$/;

/** GET ?code=XTNL-XXXXXX — watch polls until authorized or expired */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  /* Validate format before any DB access */
  if (!code || !CODE_RE.test(code)) {
    return NextResponse.json({ status: "expired" });
  }

  const { data } = await supabase
    .from("comments")
    .select("content")
    .like("content", `${PREFIX}%`)
    .order("Entry", { ascending: false })
    .limit(100);

  const record = (data ?? [])
    .map(r => { try { return JSON.parse(r.content.slice(PREFIX.length)); } catch { return null; } })
    .find(r => r?.deviceCode === code);

  if (!record || Date.now() > record.expiresMs)
    return NextResponse.json({ status: "expired" });

  if (record.status === "authorized" && record.token)
    return NextResponse.json({ status: "authorized", token: record.token, expiresAt: record.tokenExpiresAt });

  return NextResponse.json({ status: "pending" });
}
