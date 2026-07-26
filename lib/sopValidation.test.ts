import { describe, it, expect } from "vitest";
import { validateSopInput } from "./sopValidation";

const validBody = { title: "Entry Discipline", items: ["Check spread", "Confirm bias"], tags: ["entry"] };

describe("validateSopInput", () => {
  it("rejects a non-object body", () => {
    expect(validateSopInput(null)).toEqual({ ok: false, error: "Invalid request body" });
    expect(validateSopInput("nope")).toEqual({ ok: false, error: "Invalid request body" });
    expect(validateSopInput(42)).toEqual({ ok: false, error: "Invalid request body" });
  });

  it("rejects a missing or whitespace-only title", () => {
    expect(validateSopInput({ ...validBody, title: undefined })).toEqual({ ok: false, error: "Title is required" });
    expect(validateSopInput({ ...validBody, title: "   " })).toEqual({ ok: false, error: "Title is required" });
    expect(validateSopInput({ ...validBody, title: 5 })).toEqual({ ok: false, error: "Title is required" });
  });

  it("rejects a title over 200 characters", () => {
    const result = validateSopInput({ ...validBody, title: "x".repeat(201) });
    expect(result).toEqual({ ok: false, error: "Title must be 200 characters or fewer" });
  });

  it("accepts a title of exactly 200 characters", () => {
    const result = validateSopInput({ ...validBody, title: "x".repeat(200) });
    expect(result.ok).toBe(true);
  });

  it("trims the title", () => {
    const result = validateSopInput({ ...validBody, title: "  Entry Discipline  " });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.title).toBe("Entry Discipline");
  });

  it("rejects items that are not an array", () => {
    expect(validateSopInput({ ...validBody, items: "not an array" })).toEqual({ ok: false, error: "items must be an array" });
    expect(validateSopInput({ ...validBody, items: undefined })).toEqual({ ok: false, error: "items must be an array" });
  });

  it("filters non-string and blank items before counting", () => {
    const result = validateSopInput({ ...validBody, items: ["Check spread", 42, "  ", null, "Confirm bias"] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.items).toEqual(["Check spread", "Confirm bias"]);
  });

  it("rejects fewer than 1 checklist row", () => {
    expect(validateSopInput({ ...validBody, items: [] })).toEqual({ ok: false, error: "At least 1 checklist row is required" });
    expect(validateSopInput({ ...validBody, items: ["   "] })).toEqual({ ok: false, error: "At least 1 checklist row is required" });
  });

  it("accepts exactly 1 checklist row", () => {
    const result = validateSopInput({ ...validBody, items: ["Only row"] });
    expect(result.ok).toBe(true);
  });

  it("rejects more than 12 checklist rows", () => {
    const items = Array.from({ length: 13 }, (_, i) => `Row ${i}`);
    expect(validateSopInput({ ...validBody, items })).toEqual({ ok: false, error: "At most 12 checklist rows are allowed" });
  });

  it("accepts exactly 12 checklist rows", () => {
    const items = Array.from({ length: 12 }, (_, i) => `Row ${i}`);
    expect(validateSopInput({ ...validBody, items }).ok).toBe(true);
  });

  it("rejects a row over 300 characters", () => {
    const result = validateSopInput({ ...validBody, items: ["x".repeat(301)] });
    expect(result).toEqual({ ok: false, error: "Each row must be 300 characters or fewer" });
  });

  it("defaults tags to an empty array when absent or malformed", () => {
    const r1 = validateSopInput({ ...validBody, tags: undefined });
    const r2 = validateSopInput({ ...validBody, tags: "not-an-array" });
    expect(r1.ok && r1.value.tags).toEqual([]);
    expect(r2.ok && r2.value.tags).toEqual([]);
  });

  it("filters non-string tags and blank/oversized tags", () => {
    const result = validateSopInput({ ...validBody, tags: ["entry", 5, "  ", "x".repeat(41), "valid"] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.tags).toEqual(["entry", "valid"]);
  });

  it("dedupes tags case-insensitively, keeping the first-seen casing", () => {
    const result = validateSopInput({ ...validBody, tags: ["Entry", "entry", "ENTRY", "exit"] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.tags).toEqual(["Entry", "exit"]);
  });

  it("caps tags at 20", () => {
    const tags = Array.from({ length: 25 }, (_, i) => `tag${i}`);
    const result = validateSopInput({ ...validBody, tags });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.tags.length).toBe(20);
  });

  it("returns the full trimmed value on the happy path", () => {
    const result = validateSopInput({ title: "  Entry  ", items: ["  Row 1  "], tags: ["  Tag  "] });
    expect(result).toEqual({ ok: true, value: { title: "Entry", items: ["Row 1"], tags: ["Tag"] } });
  });
});
