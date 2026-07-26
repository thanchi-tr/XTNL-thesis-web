import { describe, it, expect } from "vitest";
import { activeSolution, scratchActive, type Solution } from "./solutions";

function makeSolution(overrides: Partial<Solution> = {}): Solution {
  return {
    id: "s1",
    description: "Do the thing",
    proposed_by: "a@xtnl-solutions.com",
    created_at: "2026-01-01T00:00:00Z",
    week_tag: "2026-01-01",
    status: "active",
    scratched_at: null,
    scratched_by: null,
    endorsements: 0,
    disregards: 0,
    votes: 0,
    observed_week_1: null,
    observed_week_2: null,
    observed_week_3: null,
    all_observed_at: null,
    ...overrides,
  };
}

describe("activeSolution", () => {
  it("returns the active solution when one exists", () => {
    const sols = [makeSolution({ id: "s1", status: "scratched" }), makeSolution({ id: "s2", status: "active" })];
    expect(activeSolution(sols)?.id).toBe("s2");
  });

  it("returns null when no solution is active", () => {
    const sols = [makeSolution({ id: "s1", status: "scratched" })];
    expect(activeSolution(sols)).toBeNull();
  });

  it("returns null for an empty array", () => {
    expect(activeSolution([])).toBeNull();
  });
});

describe("scratchActive", () => {
  it("marks the active entry scratched with actor and timestamp", () => {
    const sols = [makeSolution({ id: "s1", status: "active" })];
    const result = scratchActive(sols, "b@xtnl-solutions.com", "2026-02-01T00:00:00Z");
    expect(result[0]).toMatchObject({
      id: "s1", status: "scratched",
      scratched_by: "b@xtnl-solutions.com", scratched_at: "2026-02-01T00:00:00Z",
    });
  });

  it("leaves already-scratched entries untouched", () => {
    const sols = [makeSolution({ id: "s1", status: "scratched", scratched_by: "orig@x.com", scratched_at: "2025-01-01T00:00:00Z" })];
    const result = scratchActive(sols, "b@xtnl-solutions.com", "2026-02-01T00:00:00Z");
    expect(result[0]).toEqual(sols[0]);
  });

  it("does not mutate the input array", () => {
    const sols = [makeSolution({ id: "s1", status: "active" })];
    scratchActive(sols, "b@xtnl-solutions.com", "2026-02-01T00:00:00Z");
    expect(sols[0].status).toBe("active");
  });

  it("returns an empty array for an empty input", () => {
    expect(scratchActive([], "b@xtnl-solutions.com", "2026-02-01T00:00:00Z")).toEqual([]);
  });
});
