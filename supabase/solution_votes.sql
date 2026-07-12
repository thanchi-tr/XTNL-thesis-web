-- Add vote counter to issue_solutions.
-- Run once in Supabase SQL Editor before deploying the +1 solution rating feature.

ALTER TABLE issue_solutions
  ADD COLUMN IF NOT EXISTS votes INTEGER NOT NULL DEFAULT 0;
