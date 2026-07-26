import { vi } from "vitest";
import { supabase } from "@/lib/supabase";

/**
 * A REAL in-memory fake Supabase client — unlike tests/setup/supabaseMock.ts
 * (a stateless per-call FIFO queue, reset fresh each test), this one keeps
 * an actual per-table row store across a whole test, and its query builder
 * actually applies `.eq()/.in()/.gte()` as real filters and
 * `.insert()/.update()/.delete()/.upsert()` as real mutations against it.
 *
 * Built for cross-route WORKFLOW integration tests — chaining several real
 * route handler calls against one shared store, so what one route WRITES is
 * proven to be exactly what a later route's real filtered READ finds. The
 * stateless mock can't catch that class of bug: each test programs its own
 * fake response in isolation, so a mismatch between what one route writes
 * and what another expects to read would never surface.
 *
 * Existing unit tests keep using the stateless mock unchanged — this is a
 * parallel implementation, not a replacement.
 */

type Row = Record<string, any>;

const COMPARATORS = {
  eq: (a: any, b: any) => a === b,
  gte: (a: any, b: any) => a >= b,
  in: (a: any, b: any[]) => b.includes(a),
} as const;

type Filter = { col: string; op: keyof typeof COMPARATORS; val: any };

/** Table -> "embedded resource" foreign-key relationship, for the one join
 *  pattern actually used in this app: `sop_enforcements.select("sop_id,
 *  sop_checklists(*)")`. Real PostgREST returns a many-to-one embed as a
 *  single object, not an array — matching that here since the route code
 *  under test already defensively handles both shapes. */
const EMBEDS: Record<string, { embedTable: string; localCol: string; foreignCol: string }> = {
  sop_enforcements: { embedTable: "sop_checklists", localCol: "sop_id", foreignCol: "id" },
};

/** Primary-key column + generator per table — most tables use a numeric
 *  `id` (a Postgres serial), but `issues` uses a DB-generated UUID under
 *  the literal column name `issue_id` (see app/api/session/issues/route.ts,
 *  which never sets it in the insert payload and reads it back via
 *  `.select("issue_id")`). */
const PRIMARY_KEYS: Record<string, { col: string; gen: (store: StatefulSupabaseStore, table: string) => any }> = {
  issues: { col: "issue_id", gen: () => `issue-${Math.random().toString(36).slice(2, 10)}` },
};
const DEFAULT_PK = { col: "id", gen: (store: StatefulSupabaseStore, table: string) => store.allocateId(table) };

export class StatefulSupabaseStore {
  private tables = new Map<string, Row[]>();
  private nextId = new Map<string, number>();

  seed(table: string, rows: Row[]) {
    this.tables.set(table, [...(this.tables.get(table) ?? []), ...rows]);
    return this;
  }

  getTable(table: string): Row[] {
    return this.tables.get(table) ?? [];
  }

  replaceTable(table: string, rows: Row[]) {
    this.tables.set(table, rows);
  }

  allocateId(table: string): number {
    const id = this.nextId.get(table) ?? 1;
    this.nextId.set(table, id + 1);
    return id;
  }

  from(table: string) {
    return new StatefulQueryBuilder(this, table);
  }

  install() {
    return vi.spyOn(supabase, "from").mockImplementation((table: string) => this.from(table) as any);
  }
}

class StatefulQueryBuilder implements PromiseLike<{ data: any; error: any }> {
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Row | Row[] | null = null;
  private onConflict: string | null = null;
  private selectCols = "*";
  private filters: Filter[] = [];
  private orderCol: string | null = null;
  private orderAscending = true;
  private limitN: number | null = null;
  private singleMode: "single" | "maybeSingle" | null = null;

  constructor(private store: StatefulSupabaseStore, private table: string) {}

  select(cols = "*") { this.selectCols = cols; return this; }
  insert(payload: Row | Row[]) { this.op = "insert"; this.payload = payload; return this; }
  update(payload: Row) { this.op = "update"; this.payload = payload; return this; }
  delete() { this.op = "delete"; return this; }
  upsert(payload: Row | Row[], opts?: { onConflict?: string }) {
    this.op = "upsert"; this.payload = payload; this.onConflict = opts?.onConflict ?? null; return this;
  }
  eq(col: string, val: any) { this.filters.push({ col, op: "eq", val }); return this; }
  gte(col: string, val: any) { this.filters.push({ col, op: "gte", val }); return this; }
  in(col: string, val: any[]) { this.filters.push({ col, op: "in", val }); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orderCol = col; this.orderAscending = opts?.ascending ?? true; return this; }
  limit(n: number) { this.limitN = n; return this; }
  single() { this.singleMode = "single"; return this; }
  maybeSingle() { this.singleMode = "maybeSingle"; return this; }

  private matches(row: Row): boolean {
    return this.filters.every(f => COMPARATORS[f.op](row[f.col], f.val));
  }

  private applyEmbeds(rows: Row[]): Row[] {
    if (!this.selectCols.includes("(")) return rows;
    const embed = EMBEDS[this.table];
    if (!embed || !this.selectCols.includes(embed.embedTable)) return rows;
    const foreignRows = this.store.getTable(embed.embedTable);
    return rows.map(row => ({
      ...row,
      [embed.embedTable]: foreignRows.find(fr => fr[embed.foreignCol] === row[embed.localCol]) ?? null,
    }));
  }

  private finalize(rows: Row[]): { data: any; error: any } {
    let result = [...rows];
    if (this.orderCol) {
      result.sort((a, b) => {
        const av = a[this.orderCol!]; const bv = b[this.orderCol!];
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return this.orderAscending ? cmp : -cmp;
      });
    }
    if (this.limitN != null) result = result.slice(0, this.limitN);

    if (this.singleMode === "single") {
      if (result.length === 1) return { data: result[0], error: null };
      if (result.length === 0) return { data: null, error: { message: "No rows found", code: "PGRST116" } };
      return { data: null, error: { message: "Multiple rows returned for single()", code: "PGRST117" } };
    }
    if (this.singleMode === "maybeSingle") {
      if (result.length > 1) return { data: null, error: { message: "Multiple rows returned for maybeSingle()", code: "PGRST117" } };
      return { data: result[0] ?? null, error: null };
    }
    return { data: result, error: null };
  }

  private execute(): { data: any; error: any } {
    const table = this.store.getTable(this.table);

    if (this.op === "select") {
      const matched = table.filter(row => this.matches(row));
      return this.finalize(this.applyEmbeds(matched));
    }

    if (this.op === "insert") {
      const pk = PRIMARY_KEYS[this.table] ?? DEFAULT_PK;
      const toInsert = Array.isArray(this.payload) ? this.payload : [this.payload!];
      const inserted = toInsert.map(row =>
        row[pk.col] != null ? { ...row } : { [pk.col]: pk.gen(this.store, this.table), ...row }
      );
      this.store.seed(this.table, inserted);
      return this.finalize(inserted);
    }

    if (this.op === "update") {
      const matched = table.filter(row => this.matches(row));
      for (const row of matched) Object.assign(row, this.payload);
      return this.finalize(matched);
    }

    if (this.op === "delete") {
      const remaining = table.filter(row => !this.matches(row));
      const removed = table.filter(row => this.matches(row));
      this.store.replaceTable(this.table, remaining);
      return this.finalize(removed);
    }

    if (this.op === "upsert") {
      const toUpsert = Array.isArray(this.payload) ? this.payload : [this.payload!];
      const results: Row[] = [];
      for (const incoming of toUpsert) {
        const conflictCol = this.onConflict;
        const existing = conflictCol ? table.find(row => row[conflictCol] === incoming[conflictCol]) : undefined;
        if (existing) {
          Object.assign(existing, incoming);
          results.push(existing);
        } else {
          const row = { id: this.store.allocateId(this.table), ...incoming };
          this.store.seed(this.table, [row]);
          results.push(row);
        }
      }
      return this.finalize(results);
    }

    return { data: null, error: { message: `Unsupported op: ${this.op}` } };
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}
