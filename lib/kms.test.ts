import { describe, it, expect } from "vitest";
import {
  isValidTaxonomyPath, toKmsStatus, tradingSessionsSince,
  triageScore, similarityPct, priorityToSev, taxonomyLabels,
} from "./kms";

describe("taxonomyLabels", () => {
  it("resolves the display labels for a full valid path", () => {
    expect(taxonomyLabels("biological", "cognitive_drift", "session_abandonment")).toEqual({
      domain: "Biological Substrate", subsystem: "Dopamine Relapse", leaf: "Session abandonment",
    });
  });

  it("returns nulls for an unknown domain", () => {
    expect(taxonomyLabels("nope", "cognitive_drift", "session_abandonment")).toEqual({
      domain: null, subsystem: null, leaf: null,
    });
  });

  it("returns a null leaf for a valid domain/subsystem with an unknown leaf", () => {
    expect(taxonomyLabels("biological", "cognitive_drift", "nope")).toEqual({
      domain: "Biological Substrate", subsystem: "Dopamine Relapse", leaf: null,
    });
  });

  it("handles missing arguments (null/undefined)", () => {
    expect(taxonomyLabels(null, undefined, null)).toEqual({ domain: null, subsystem: null, leaf: null });
    expect(taxonomyLabels()).toEqual({ domain: null, subsystem: null, leaf: null });
  });
});

describe("isValidTaxonomyPath", () => {
  it("accepts an exact Domain/Sub-System/Leaf node", () => {
    expect(isValidTaxonomyPath("biological", "cognitive_drift", "session_abandonment")).toBe(true);
  });

  it("rejects an unknown domain", () => {
    expect(isValidTaxonomyPath("nonexistent", "cognitive_drift", "session_abandonment")).toBe(false);
  });

  it("rejects a valid domain with an unknown subsystem", () => {
    expect(isValidTaxonomyPath("biological", "nonexistent", "session_abandonment")).toBe(false);
  });

  it("rejects a valid domain/subsystem with an unknown leaf", () => {
    expect(isValidTaxonomyPath("biological", "cognitive_drift", "nonexistent")).toBe(false);
  });

  it("rejects a leaf that exists but under a different subsystem", () => {
    // "session_abandonment" belongs to cognitive_drift, not visual_fatigue
    expect(isValidTaxonomyPath("biological", "visual_fatigue", "session_abandonment")).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(isValidTaxonomyPath("", "", "")).toBe(false);
  });
});

describe("toKmsStatus", () => {
  it("returns the kms value directly when it is already a known status", () => {
    expect(toKmsStatus("OOS_VALIDATION", "in_progress")).toBe("OOS_VALIDATION");
  });

  it("falls back to legacy status mapping when kms is null", () => {
    expect(toKmsStatus(null, "in_progress")).toBe("TOOL_QUEUED");
    expect(toKmsStatus(null, "staging")).toBe("OOS_VALIDATION");
    expect(toKmsStatus(null, "archived")).toBe("BASELINE_RESTORED");
    expect(toKmsStatus(null, "open")).toBe("TRIAGE_PENDING");
  });

  it("falls back to legacy status mapping when kms is an unrecognized string", () => {
    expect(toKmsStatus("garbage", "staging")).toBe("OOS_VALIDATION");
  });

  it("falls back to legacy status mapping when kms is undefined", () => {
    expect(toKmsStatus(undefined, "archived")).toBe("BASELINE_RESTORED");
  });
});

describe("tradingSessionsSince", () => {
  const MONDAY_NOON_UTC = "2026-07-06T02:00:00Z"; // Monday 12:00 AEST (no DST in July)

  it("returns 0 when 'from' is not before 'now'", () => {
    const now = new Date(MONDAY_NOON_UTC);
    expect(tradingSessionsSince(MONDAY_NOON_UTC, now)).toBe(0);
    expect(tradingSessionsSince("2026-07-07T02:00:00Z", now)).toBe(0);
  });

  it("returns 0 for an unparsable date", () => {
    expect(tradingSessionsSince("not-a-date", new Date(MONDAY_NOON_UTC))).toBe(0);
  });

  it("counts Tue-Fri as 4 sessions across a Mon->Sat window, excluding the weekend start", () => {
    const now = new Date("2026-07-11T02:00:00Z"); // Saturday 12:00 AEST, 5x24h later
    expect(tradingSessionsSince(MONDAY_NOON_UTC, now)).toBe(4);
  });

  it("excludes both weekend days across a full Mon->Mon window", () => {
    const now = new Date("2026-07-13T02:00:00Z"); // next Monday 12:00 AEST, 7x24h later
    expect(tradingSessionsSince(MONDAY_NOON_UTC, now)).toBe(5);
  });
});

describe("priorityToSev", () => {
  it("maps 0 and 1 to SEV1", () => {
    expect(priorityToSev(0)).toBe(1);
    expect(priorityToSev(1)).toBe(1);
  });
  it("maps 2 to SEV2", () => {
    expect(priorityToSev(2)).toBe(2);
  });
  it("maps 3 and 4 to SEV3", () => {
    expect(priorityToSev(3)).toBe(3);
    expect(priorityToSev(4)).toBe(3);
  });
  it("maps 5+ to SEV4", () => {
    expect(priorityToSev(5)).toBe(4);
    expect(priorityToSev(10)).toBe(4);
  });
});

describe("triageScore", () => {
  const ledger = [
    { issue_id: "a", title: "Broker API latency spike", description: "slow fills", domain: "hardware", subsystem: "network", leaf_node: "broker_api_latency" },
    { issue_id: "b", title: "Unrelated cosmetic issue", description: "button color", domain: null, subsystem: null, leaf_node: null },
  ];

  it("scores a title-token match higher than an unrelated candidate", () => {
    const draft = { title: "broker latency", description: "", domain: "hardware", subsystem: "network", leaf: "broker_api_latency" };
    const matches = triageScore(draft, ledger);
    expect(matches[0].issue_id).toBe("a");
    expect(matches.find(m => m.issue_id === "b")).toBeUndefined();
  });

  it("returns no matches when nothing overlaps", () => {
    const draft = { title: "zzz", description: "zzz", domain: "trust_governance", subsystem: "audit_integrity", leaf: "signoff_bypass" };
    expect(triageScore(draft, ledger).find(m => m.issue_id === "a")).toBeUndefined();
  });

  it("gives a leaf-node match the largest bonus", () => {
    const draft = { title: "", description: "", domain: "hardware", subsystem: "network", leaf: "broker_api_latency" };
    const matches = triageScore(draft, ledger);
    expect(matches[0]).toEqual({ issue_id: "a", score: 6 });
  });

  it("gives a subsystem-only match a smaller bonus than a leaf match", () => {
    const draft = { title: "", description: "", domain: "hardware", subsystem: "network", leaf: "different_leaf" };
    const matches = triageScore(draft, ledger);
    expect(matches[0]).toEqual({ issue_id: "a", score: 3 });
  });

  it("gives a domain-only match the smallest taxonomy bonus", () => {
    const draft = { title: "", description: "", domain: "hardware", subsystem: "different_sub", leaf: "different_leaf" };
    const matches = triageScore(draft, ledger);
    expect(matches[0]).toEqual({ issue_id: "a", score: 1 });
  });

  it("scores a candidate description token against the draft title and description", () => {
    const localLedger = [
      { issue_id: "x", title: "unrelated", description: "broker latency issue", domain: null, subsystem: null, leaf_node: null },
    ];
    // "broker" appears in both candidate description and draft title (1.5), "latency" in both descriptions (0.5)
    const draft = { title: "broker", description: "latency", domain: "", subsystem: "", leaf: "" };
    const matches = triageScore(draft, localLedger);
    expect(matches[0].score).toBeCloseTo(2.0);
  });

  it("scores a candidate title token against the draft description (not just the title)", () => {
    const localLedger = [
      { issue_id: "x", title: "spike event", description: "", domain: null, subsystem: null, leaf_node: null },
    ];
    const draft = { title: "unrelated", description: "spike", domain: "", subsystem: "", leaf: "" };
    const matches = triageScore(draft, localLedger);
    expect(matches[0].score).toBeCloseTo(1.5);
  });

  it("tolerates a null candidate description and sorts multiple matches by score descending", () => {
    const localLedger = [
      { issue_id: "low", title: "broker", description: null, domain: null, subsystem: null, leaf_node: null },
      { issue_id: "high", title: "broker latency spike", description: null, domain: null, subsystem: null, leaf_node: null },
    ];
    const draft = { title: "broker latency spike", description: "", domain: "", subsystem: "", leaf: "" };
    const matches = triageScore(draft, localLedger);
    expect(matches[0].issue_id).toBe("high");
    expect(matches[1].issue_id).toBe("low");
    expect(matches[0].score).toBeGreaterThan(matches[1].score);
  });
});

describe("similarityPct", () => {
  it("maps a score of 0 to 0%", () => {
    expect(similarityPct(0)).toBe(0);
  });
  it("caps at 99.9%", () => {
    expect(similarityPct(1000)).toBe(99.9);
  });
  it("is monotonically increasing with score", () => {
    expect(similarityPct(10)).toBeGreaterThan(similarityPct(1));
  });
});
