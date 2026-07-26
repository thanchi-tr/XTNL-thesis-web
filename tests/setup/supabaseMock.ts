import { vi } from "vitest";
import { supabase } from "@/lib/supabase";

export type SupabaseResult = { data: any; error: any };

/**
 * Minimal fluent stand-in for supabase-js's PostgrestFilterBuilder. Every
 * chain method used across the app's routes returns `this`; the object is
 * itself thenable (mirroring the real builder), so `await supabase.from(...)
 * .select()...` resolves to the programmed result without a real network call.
 */
class FakeQueryBuilder implements PromiseLike<SupabaseResult> {
  constructor(private result: SupabaseResult) {}

  select() { return this; }
  insert() { return this; }
  update() { return this; }
  delete() { return this; }
  upsert() { return this; }
  eq() { return this; }
  in() { return this; }
  gte() { return this; }
  order() { return this; }
  limit() { return this; }
  single() { return this; }
  maybeSingle() { return this; }

  then<TResult1 = SupabaseResult, TResult2 = never>(
    onfulfilled?: ((value: SupabaseResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

/**
 * Mocks `supabase.from(table)` for the duration of a test. Pass either a
 * single `{data, error}` (returned for every call to that table) or an array
 * (returned in order, one per call — for routes that hit the same table more
 * than once, e.g. delete-then-insert; the last entry repeats if the route
 * calls the table more times than programmed).
 */
export function mockSupabaseFrom(responses: Record<string, SupabaseResult | SupabaseResult[]>) {
  const queues = new Map<string, { list: SupabaseResult[]; index: number }>();
  for (const [table, r] of Object.entries(responses)) {
    queues.set(table, { list: Array.isArray(r) ? r : [r], index: 0 });
  }

  return vi.spyOn(supabase, "from").mockImplementation((table: string) => {
    const q = queues.get(table);
    const result = q ? q.list[Math.min(q.index, q.list.length - 1)] : { data: null, error: null };
    if (q) q.index++;
    return new FakeQueryBuilder(result) as any;
  });
}
