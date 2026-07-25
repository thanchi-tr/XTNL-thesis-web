/**
 * Shared shape for `issues.solutions` — a JSONB array of every solution
 * ever proposed for an issue (see sql/issue_solutions_migration.sql). At
 * most one entry has status "active" at a time; scratched entries stay in
 * the array rather than being deleted or moved out to an event-log-only
 * history, so they can be shown grayed-out and restored.
 */

export interface Solution {
  id:              string;
  description:     string;
  proposed_by:     string;
  created_at:      string;
  /** Monday-AEST week key (see lib/weekKey.ts) for when this became the
   *  active solution — set on propose AND on restore, since both actions
   *  mean "this is the week's assigned solution" as of now. Null for rows
   *  backfilled from the pre-multi-solution schema. */
  week_tag:        string | null;
  status:          "active" | "scratched";
  scratched_at:    string | null;
  scratched_by:    string | null;
  endorsements:    number;
  disregards:      number;
  votes:           number;
  observed_week_1: string | null;
  observed_week_2: string | null;
  observed_week_3: string | null;
  all_observed_at: string | null;
}

export function activeSolution(solutions: Solution[]): Solution | null {
  return solutions.find(s => s.status === "active") ?? null;
}

/** Returns a new array with the currently-active entry (if any) marked
 *  scratched — used before activating a different solution. */
export function scratchActive(solutions: Solution[], scratchedBy: string, now: string): Solution[] {
  return solutions.map(s =>
    s.status === "active"
      ? { ...s, status: "scratched" as const, scratched_at: now, scratched_by: scratchedBy }
      : s
  );
}
