-- ── KMS Migration — Zero-Trust Knowledge Management System ────────────────────
-- Implements the institutional KMS blueprint:
--   • Hierarchical Root-Cause Ontology columns (domain / subsystem / leaf_node)
--   • Survivability status pipeline (kms_status)
--   • Digital Tool Registry decoupled from issues (ON DELETE RESTRICT)
--   • Weighted full-text index for the Zero-Knowledge Triage intercept
--   • Immutable, append-only relapse counter (trigger-enforced)
--
-- HOW TO RUN: execute each numbered step in the Supabase SQL Editor, in order.
-- All steps are additive / non-destructive to existing issue data.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── STEP 1: Ontology + pipeline columns on issues ─────────────────────────────
ALTER TABLE issues ADD COLUMN IF NOT EXISTS domain        TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS subsystem     TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS leaf_node     TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS kms_status    TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS oos_started_at TIMESTAMPTZ;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS baseline_at    TIMESTAMPTZ;

-- Backfill the survivability pipeline from legacy statuses (idempotent)
UPDATE issues SET kms_status = CASE status
  WHEN 'open'        THEN 'TRIAGE_PENDING'
  WHEN 'in_progress' THEN 'TOOL_QUEUED'
  WHEN 'staging'     THEN 'OOS_VALIDATION'
  WHEN 'archived'    THEN 'BASELINE_RESTORED'
  ELSE 'TRIAGE_PENDING'
END
WHERE kms_status IS NULL;

-- Carry the legacy staging clock into the OOS clock
UPDATE issues SET oos_started_at = staging_at
WHERE oos_started_at IS NULL AND staging_at IS NOT NULL;

-- ── STEP 2: Digital Tool Registry (independent asset ledger) ──────────────────
CREATE TABLE IF NOT EXISTS digital_tools (
  tool_id     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT         NOT NULL,
  category    TEXT         NOT NULL,             -- friction | firmware | protocol | hardware | biometric
  blueprint   TEXT         NOT NULL,             -- implementation description
  version     TEXT         NOT NULL DEFAULT 'v1.0',
  created_by  TEXT         NOT NULL,
  deprecated  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── STEP 3: Deployment junction — RESTRICT protects historical telemetry ──────
-- A tool linked to any issue (active or archived) can never be deleted.
CREATE TABLE IF NOT EXISTS tool_deployments (
  id          BIGSERIAL    PRIMARY KEY,
  tool_id     UUID         NOT NULL REFERENCES digital_tools(tool_id) ON DELETE RESTRICT,
  issue_id    UUID         NOT NULL REFERENCES issues(issue_id)       ON DELETE RESTRICT,
  deployed_by TEXT         NOT NULL,
  deployed_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  active      BOOLEAN      NOT NULL DEFAULT TRUE,
  relapses    INT          NOT NULL DEFAULT 0     -- OOS failures while this deployment was active
);

CREATE INDEX IF NOT EXISTS tool_deployments_tool_idx  ON tool_deployments (tool_id);
CREATE INDEX IF NOT EXISTS tool_deployments_issue_idx ON tool_deployments (issue_id);

-- ── STEP 4: Weighted FTS index for the triage intercept ───────────────────────
-- Title carries weight A (heavier), description weight B — per the blueprint.
ALTER TABLE issues ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')),       'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS issues_fts_idx ON issues USING GIN (fts);

-- ── STEP 5: Immutability of the relapse counter ───────────────────────────────
-- reopen_count is append-only: any UPDATE that lowers it is rejected outright.
CREATE OR REPLACE FUNCTION enforce_reopen_count_append_only()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reopen_count < OLD.reopen_count THEN
    RAISE EXCEPTION 'reopen_count is append-only (% -> % rejected)',
      OLD.reopen_count, NEW.reopen_count;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reopen_count_append_only ON issues;
CREATE TRIGGER reopen_count_append_only
  BEFORE UPDATE OF reopen_count ON issues
  FOR EACH ROW EXECUTE FUNCTION enforce_reopen_count_append_only();

-- ── VERIFY ────────────────────────────────────────────────────────────────────
-- SELECT kms_status, COUNT(*) FROM issues GROUP BY kms_status;
-- SELECT COUNT(*) FROM digital_tools;
