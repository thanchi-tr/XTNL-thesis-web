-- ── Analyst weekly review sign-off ───────────────────────────────────────────
-- Run this in Supabase → SQL Editor before deploying the firmware copy button.
--
-- Gates the "copy firmware to clipboard" button in the session (analyst view)
-- and the analytics page: the button stays disabled until a row exists here
-- for the current week (see lib/weekKey.ts::getMondayAESTKey). The analyst
-- creates that row explicitly via "Mark Week Reviewed" in the session view —
-- there was previously no persisted concept of "the analyst finished their
-- weekly review" anywhere in this app.

CREATE TABLE IF NOT EXISTS analyst_weekly_signoff (
  week_key      TEXT        PRIMARY KEY,   -- getMondayAESTKey() format, "YYYY-MM-DD"
  signed_off_by TEXT        NOT NULL,
  signed_off_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
