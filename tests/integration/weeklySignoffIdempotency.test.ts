import { describe, it, expect, beforeEach, vi } from "vitest";
import { auth } from "@/auth";
import { fakeSession, mockAuth } from "@/tests/setup/authMock";
import { StatefulSupabaseStore } from "@/tests/setup/statefulSupabaseMock";
import { GET as getSignoff, POST as postSignoff } from "@/app/api/session/weekly-signoff/route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(auth).mockReset();
});

describe("Workflow: weekly sign-off is a real upsert, not an insert", () => {
  it("posting twice in the same week leaves exactly one row for that week_key", async () => {
    const store = new StatefulSupabaseStore();
    store.install();

    mockAuth(auth, fakeSession(["analyst"], { userEmail: "analyst-a@xtnl-solutions.com" }));
    const first = await postSignoff();
    expect(first.status).toBe(201);

    mockAuth(auth, fakeSession(["analyst"], { userEmail: "analyst-b@xtnl-solutions.com" }));
    const second = await postSignoff();
    expect(second.status).toBe(201);

    // The stateless mock can't distinguish an `upsert` bug from an
    // `insert` bug (each call is independently pre-programmed) — this
    // proves it against real accumulated state: two POSTs, one row.
    const rows = store.getTable("analyst_weekly_signoff");
    expect(rows).toHaveLength(1);
    // The second caller's identity is what the row now reflects — real
    // upsert-on-conflict semantics, not two independent inserts.
    expect(rows[0].signed_off_by).toBe("analyst-b@xtnl-solutions.com");

    const readRes = await getSignoff();
    const readJson = await readRes.json();
    expect(readJson.signedOff).toBe(true);
    expect(readJson.signedOffBy).toBe("analyst-b@xtnl-solutions.com");
  });
});
