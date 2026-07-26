import { describe, it, expect, afterEach, vi } from "vitest";
import { getMondayAESTKey, getMondayAESTKeyWeeksAgo } from "./weekKey";

/** 2026-04-13 is a Monday. AEST is a fixed UTC+10 offset (no DST in this
 *  module's math), so local-midnight Monday 2026-04-13 is 2026-04-12T14:00:00Z. */
const MONDAY_AEST_MIDNIGHT_UTC = "2026-04-12T14:00:00Z";

afterEach(() => {
  vi.useRealTimers();
});

describe("getMondayAESTKeyWeeksAgo", () => {
  it("returns today's date when 'now' is already Monday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(MONDAY_AEST_MIDNIGHT_UTC));
    expect(getMondayAESTKeyWeeksAgo(0)).toBe("2026-04-13");
  });

  it("anchors back to Monday from a Sunday", () => {
    vi.useFakeTimers();
    // 2026-04-19 is the Sunday of the same week; noon AEST = 2026-04-19T02:00:00Z.
    vi.setSystemTime(new Date("2026-04-19T02:00:00Z"));
    expect(getMondayAESTKeyWeeksAgo(0)).toBe("2026-04-13");
  });

  it("anchors back to Monday from a mid-week day (Wednesday)", () => {
    vi.useFakeTimers();
    // 2026-04-15 is Wednesday of the same week; noon AEST = 2026-04-15T02:00:00Z.
    vi.setSystemTime(new Date("2026-04-15T02:00:00Z"));
    expect(getMondayAESTKeyWeeksAgo(0)).toBe("2026-04-13");
  });

  it("computes a past week for positive weeksAgo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(MONDAY_AEST_MIDNIGHT_UTC));
    expect(getMondayAESTKeyWeeksAgo(1)).toBe("2026-04-06");
  });

  it("computes a future week for negative weeksAgo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(MONDAY_AEST_MIDNIGHT_UTC));
    expect(getMondayAESTKeyWeeksAgo(-1)).toBe("2026-04-20");
  });
});

describe("getMondayAESTKey", () => {
  it("delegates to getMondayAESTKeyWeeksAgo(0)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(MONDAY_AEST_MIDNIGHT_UTC));
    expect(getMondayAESTKey()).toBe(getMondayAESTKeyWeeksAgo(0));
  });
});
