/**
 * Returns the ISO date (YYYY-MM-DD) for the Monday of the AEST trading week
 * `weeksAgo` weeks before the current one (0 = this week), using fixed
 * UTC+10 offset — identical logic to the server-side key in
 * /api/data/report/route.ts.
 *
 * Safe to call on both client and server (no DOM APIs used).
 */
export function getMondayAESTKeyWeeksAgo(weeksAgo: number): string {
  const aestMs   = Date.now() + 10 * 60 * 60 * 1000;   // UTC+10 (AEST standard)
  const aestDate = new Date(aestMs);
  const dow      = aestDate.getUTCDay();                 // 0 = Sun … 6 = Sat
  const backDays = dow === 0 ? 6 : dow - 1;             // days back to Monday
  const mondayMs = aestMs - backDays * 24 * 60 * 60 * 1000 - weeksAgo * 7 * 24 * 60 * 60 * 1000;
  return new Date(mondayMs).toISOString().slice(0, 10);  // "YYYY-MM-DD"
}

/** Monday of the current AEST trading week. See getMondayAESTKeyWeeksAgo. */
export function getMondayAESTKey(): string {
  return getMondayAESTKeyWeeksAgo(0);
}
