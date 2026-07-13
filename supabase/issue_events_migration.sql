-- ── Issue Events Migration ────────────────────────────────────────────────────
-- Collapses issue_raises + issue_reopens + issue_solutions into a single
-- append-only event log (issue_events) following the Event Sourcing pattern.
--
-- The active solution state is denormalized into issues.current_solution JSONB
-- so the GET /api/session/issues query touches only two tables (issues + one
-- filtered join on issue_events) instead of 5-way nested joins.
--
-- HOW TO RUN:
--   Execute each numbered step in the Supabase SQL Editor one at a time.
--   Steps 1-4 are non-destructive (additive). Drop Step 5 only after you have
--   deployed and verified the new routes.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── STEP 1: Create issue_events table ─────────────────────────────────────────
-- Append-only. Never UPDATE or DELETE rows here — that destroys the audit trail.
--
-- event_type values:
--   RAISED              replaces issue_raises
--   REOPENED            replaces issue_reopens
--   SOLUTION_PROPOSED   first write of a new solution
--   SOLUTION_SCRATCHED  strategist discards a solution (carries full copy for history)
--   SOLUTION_OBSERVED   week 1 / 2 / 3 observed-resolve checkmark
--   SOLUTION_ENDORSED   operator endorses the active solution
--   SOLUTION_DISREGARDED operator disregards the active solution
--   SOLUTION_VOTED      generic vote increment
--   CLOSED              strategist manually closes an issue

CREATE TABLE IF NOT EXISTS issue_events (
  id          BIGSERIAL    PRIMARY KEY,
  issue_id    UUID         NOT NULL REFERENCES issues(issue_id) ON DELETE CASCADE,
  event_type  TEXT         NOT NULL,
  actor       TEXT,                          -- email or user id of the person acting
  payload     JSONB        NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS issue_events_issue_id_idx ON issue_events (issue_id, created_at DESC);
CREATE INDEX IF NOT EXISTS issue_events_type_idx     ON issue_events (event_type);


-- ── STEP 2: Add current_solution JSONB column to issues ───────────────────────
-- Denormalized snapshot of the active solution. Updated atomically by the routes
-- whenever a solution is proposed / scratched / observed / endorsed / disregarded.
-- NULL means no active solution exists for that issue.
--
-- Shape (TypeScript equivalent):
--   {
--     id:              string;   // UUID generated at proposal time
--     description:     string;
--     proposed_by:     string;
--     created_at:      string;
--     endorsements:    number;
--     disregards:      number;
--     votes:           number;
--     observed_week_1: string | null;
--     observed_week_2: string | null;
--     observed_week_3: string | null;
--     all_observed_at: string | null;
--   }

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS current_solution JSONB DEFAULT NULL;


-- ── STEP 3: Migrate historical data ───────────────────────────────────────────
-- Run each block individually and confirm row counts look right.

-- 3a. Migrate issue_raises → RAISED events
-- issue_raises has no created_at column, so we use now() as the event timestamp.
INSERT INTO issue_events (issue_id, event_type, actor, payload)
SELECT
  issue_id,
  'RAISED',
  raised_by,
  jsonb_build_object('raised_by', raised_by)
FROM issue_raises;
-- Expected: same row count as issue_raises

-- 3b. Migrate issue_reopens → REOPENED events
-- issue_reopens has no created_at column, omit it so DEFAULT now() fires.
INSERT INTO issue_events (issue_id, event_type, actor, payload)
SELECT
  issue_id,
  'REOPENED',
  reopened_by,
  jsonb_build_object(
    'reason',          reason,
    'previous_status', previous_status,
    'priority_before', priority_before,
    'priority_after',  priority_after
  )
FROM issue_reopens;
-- Expected: same row count as issue_reopens

-- 3c. Migrate scratched solutions → SOLUTION_PROPOSED + SOLUTION_SCRATCHED event pairs
--     (preserves the full timeline: proposed-then-scratched is two events)
INSERT INTO issue_events (issue_id, event_type, actor, payload, created_at)
SELECT
  issue_id,
  'SOLUTION_PROPOSED',
  proposed_by,
  jsonb_build_object(
    'solution_id', solution_id::text,
    'description', description,
    'proposed_by', proposed_by
  ),
  created_at
FROM issue_solutions
WHERE solution_status = 'scratched';

INSERT INTO issue_events (issue_id, event_type, actor, payload, created_at)
SELECT
  issue_id,
  'SOLUTION_SCRATCHED',
  scratched_by,
  jsonb_build_object(
    'solution_id', solution_id::text,
    'description', description,
    'proposed_by', proposed_by,
    'scratched_at', scratched_at
  ),
  COALESCE(scratched_at, now())
FROM issue_solutions
WHERE solution_status = 'scratched';

-- 3d. Migrate active solutions → SOLUTION_PROPOSED event + populate current_solution
INSERT INTO issue_events (issue_id, event_type, actor, payload, created_at)
SELECT
  issue_id,
  'SOLUTION_PROPOSED',
  proposed_by,
  jsonb_build_object(
    'solution_id', solution_id::text,
    'description', description,
    'proposed_by', proposed_by
  ),
  created_at
FROM issue_solutions
WHERE solution_status = 'active';

-- 3e. Migrate observed-week timestamps → SOLUTION_OBSERVED events
INSERT INTO issue_events (issue_id, event_type, actor, payload, created_at)
SELECT issue_id, 'SOLUTION_OBSERVED', NULL, jsonb_build_object('week', 1), observed_week_1
FROM issue_solutions WHERE solution_status = 'active' AND observed_week_1 IS NOT NULL;

INSERT INTO issue_events (issue_id, event_type, actor, payload, created_at)
SELECT issue_id, 'SOLUTION_OBSERVED', NULL, jsonb_build_object('week', 2), observed_week_2
FROM issue_solutions WHERE solution_status = 'active' AND observed_week_2 IS NOT NULL;

INSERT INTO issue_events (issue_id, event_type, actor, payload, created_at)
SELECT issue_id, 'SOLUTION_OBSERVED', NULL, jsonb_build_object('week', 3), observed_week_3
FROM issue_solutions WHERE solution_status = 'active' AND observed_week_3 IS NOT NULL;

-- 3f. Populate issues.current_solution from active solutions
UPDATE issues i
SET current_solution = jsonb_build_object(
  'id',              s.solution_id::text,
  'description',     s.description,
  'proposed_by',     s.proposed_by,
  'created_at',      s.created_at,
  'endorsements',    0,
  'disregards',      0,
  'votes',           0,
  'observed_week_1', s.observed_week_1,
  'observed_week_2', s.observed_week_2,
  'observed_week_3', s.observed_week_3,
  'all_observed_at', s.all_observed_at
)
FROM issue_solutions s
WHERE s.issue_id = i.issue_id
  AND s.solution_status = 'active';
-- Expected: updates one row per issue that had an active solution


-- ── STEP 4: Verify (run these SELECTs before dropping anything) ───────────────

-- Count events by type to spot obvious gaps:
SELECT event_type, COUNT(*) FROM issue_events GROUP BY event_type ORDER BY event_type;

-- Confirm every issue that had an active solution now has current_solution populated:
SELECT COUNT(*) FROM issues WHERE current_solution IS NOT NULL;

-- Spot-check a few rows:
SELECT issue_id, current_solution FROM issues WHERE current_solution IS NOT NULL LIMIT 5;


-- ── STEP 5: Drop old tables (ONLY after deploying + verifying new routes) ─────
-- WARNING: This is irreversible. Take a Supabase backup first.

-- If you have DB triggers on issue_raises that increment issues.raise_count,
-- they will be dropped automatically when the table is dropped.

-- Drop the dependent view before the table it references
DROP VIEW IF EXISTS issues_view;

DROP TABLE IF EXISTS issue_solutions;
DROP TABLE IF EXISTS issue_raises;
DROP TABLE IF EXISTS issue_reopens;

-- That's it. The issues table + issue_events table are now the only storage.
