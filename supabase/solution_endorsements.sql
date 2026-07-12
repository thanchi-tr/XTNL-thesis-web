-- Add endorsement / disregard counters to issue_solutions.
-- Run once in Supabase SQL Editor before deploying the endorse/disregard feature.

ALTER TABLE issue_solutions
  ADD COLUMN IF NOT EXISTS endorsements INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS disregards   INTEGER NOT NULL DEFAULT 0;
