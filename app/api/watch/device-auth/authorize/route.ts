import { NextResponse }       from "next/server";
import { auth }               from "@/auth";
import { supabase }           from "@/lib/supabase";
import { signWatchToken }     from "@/lib/watchJwt";
import type { Session }       from "next-auth";

const PREFIX = "watch_device:";

/** POST { deviceCode } — called by the phone /watch-auth page after the user confirms */
export async function POST(req: Request) {
  const session = await auth() as Session | null;
  if (!(session as { twoFactorVerified?: boolean } | null)?.twoFactorVerified)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { deviceCode } = await req.json() as { deviceCode?: string };
  if (!deviceCode) return NextResponse.json({ error: "Missing deviceCode" }, { status: 400 });

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
  if (!row?.parsed)            return NextResponse.json({ error: "Device code not found" }, { status: 404 });
  if (Date.now() > row.parsed.expiresMs) return NextResponse.json({ error: "Expired" }, { status: 410 });
  if (row.parsed.status === "authorized") return NextResponse.json({ ok: true }); // idempotent

  const userId = ((session.user) as { id?: string } | undefined)?.id ?? "operator";
  const { token, expiresAt: tokenExpiresAt } = await signWatchToken(userId);

  const updated = { ...row.parsed, status: "authorized", token, tokenExpiresAt };
  await supabase
    .from("comments")
    .update({ content: PREFIX + JSON.stringify(updated) })
    .eq("Entry", row.Entry);

  return NextResponse.json({ ok: true });
}
