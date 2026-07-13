-- ── Session Schedule ─────────────────────────────────────────────────────────
-- Stores the strategist-defined trading session windows.
-- Append-only: every change is a new row so the full history is preserved.
-- The active schedule is always the most-recent row (ORDER BY set_at DESC LIMIT 1).
-- Run this in Supabase → SQL Editor BEFORE deploying the updated routes.

CREATE TABLE IF NOT EXISTS session_schedule (
  id       BIGSERIAL   PRIMARY KEY,
  windows  JSONB       NOT NULL DEFAULT '[]',   -- SessionWindow[]
  set_by   TEXT,                                -- user id or email of the strategist
  set_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  note     TEXT                                 -- optional free-text reason for the change
);

CREATE INDEX IF NOT EXISTS session_schedule_set_at_idx ON session_schedule (set_at DESC);
