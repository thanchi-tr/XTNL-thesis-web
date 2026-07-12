-- ── Watch device authentication codes ───────────────────────────────────────
-- Replaces the "watch_device:" JSON blobs stored in the comments table.
-- Run this in Supabase → SQL Editor BEFORE deploying the updated routes.

CREATE TABLE IF NOT EXISTS watch_device_codes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  device_code      TEXT        UNIQUE NOT NULL,   -- e.g. "XTNL-AB3CDE"
  user_code        TEXT        NOT NULL,           -- short code shown to user
  device_id        TEXT,
  device_name      TEXT,
  status           TEXT        NOT NULL DEFAULT 'pending',   -- 'pending' | 'authorized'
  token            TEXT,
  token_expires_at TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS watch_device_codes_code_idx    ON watch_device_codes (device_code);
CREATE INDEX IF NOT EXISTS watch_device_codes_expires_idx ON watch_device_codes (expires_at);

-- ── Registered watch devices ─────────────────────────────────────────────────
-- Replaces the "watch_devices:" JSON blob stored in the comments table.

CREATE TABLE IF NOT EXISTS watch_devices (
  device_id     TEXT        PRIMARY KEY,
  device_name   TEXT        NOT NULL DEFAULT 'Galaxy Watch',
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dropped       BOOLEAN     NOT NULL DEFAULT false,
  last_seen_at  TIMESTAMPTZ
);
