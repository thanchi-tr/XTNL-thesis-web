// Default vitest environment is "node" (no `window`) for every file except
// staleCache.test.ts — this file deliberately runs there to cover the
// server-render no-op branches (`typeof window === "undefined"`).
import { describe, it, expect } from "vitest";
import { readCache, writeCache } from "./staleCache";

describe("readCache / writeCache (server, no window)", () => {
  it("readCache returns null without touching window", () => {
    expect(readCache("any-key")).toBeNull();
  });

  it("writeCache is a no-op that does not throw", () => {
    expect(() => writeCache("any-key", { a: 1 })).not.toThrow();
  });
});
