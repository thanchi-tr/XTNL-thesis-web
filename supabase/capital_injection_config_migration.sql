-- ── Capital Injection Config ─────────────────────────────────────────────────
-- Strategist-defined default fund amount. Used by the Governance page's
-- "Capital Injection" panel to reset cumulate_fund in system_memory_ledger
-- when the strategist deploys capital (streak >= 4).
-- Append-only, same pattern as session_schedule.sql: the active default is
-- always the most-recent row (ORDER BY set_at DESC LIMIT 1).
-- Run this in Supabase → SQL Editor BEFORE deploying the updated routes.
--
-- system_memory_ledger itself already exists (see
-- sql/weekly_state_ledgers_migration.sql, owned by the Python pipeline) and
-- is NOT created here — this migration only adds the strategist-facing
-- default-fund config table.

CREATE TABLE IF NOT EXISTS capital_injection_config (
  id           BIGSERIAL   PRIMARY KEY,
  default_fund NUMERIC     NOT NULL,
  set_by       TEXT,                                -- user id or email of the strategist
  set_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS capital_injection_config_set_at_idx ON capital_injection_config (set_at DESC);
