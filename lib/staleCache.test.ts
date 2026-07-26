// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readCache, writeCache } from "./staleCache";

/**
 * jsdom (and Node 22+'s own experimental global localStorage) don't reliably
 * provide a working Storage instance under Vitest's pool across environments
 * — stub a minimal in-memory implementation instead so this test is
 * deterministic regardless of the Node/jsdom version running it.
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null; }
  key(index: number) { return Array.from(this.store.keys())[index] ?? null; }
  removeItem(key: string) { this.store.delete(key); }
  setItem(key: string, value: string) { this.store.set(key, value); }
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal("localStorage", storage);
  Object.defineProperty(window, "localStorage", { value: storage, configurable: true });
});

describe("readCache / writeCache (browser)", () => {
  it("returns null when the key is not present", () => {
    expect(readCache("missing")).toBeNull();
  });

  it("round-trips a value written by writeCache", () => {
    writeCache("k", { a: 1, b: ["x", "y"] });
    expect(readCache("k")).toEqual({ a: 1, b: ["x", "y"] });
  });

  it("returns null and does not throw on malformed JSON", () => {
    storage.setItem("bad", "{not json");
    expect(readCache("bad")).toBeNull();
  });

  it("does not throw when localStorage.setItem throws (quota exceeded)", () => {
    const spy = vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => writeCache("k", { a: 1 })).not.toThrow();
    spy.mockRestore();
  });
});
