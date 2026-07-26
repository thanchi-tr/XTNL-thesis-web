import { describe, it, expect, beforeEach, vi } from "vitest";
import { auth } from "@/auth";
import { fakeSession, mockAuth } from "@/tests/setup/authMock";
import { StatefulSupabaseStore } from "@/tests/setup/statefulSupabaseMock";
import { POST as createSop } from "@/app/api/session/sops/route";
import { GET as getEnforcements, POST as postEnforcements } from "@/app/api/session/sops/enforcements/route";
import { GET as getComments } from "@/app/api/session/comments/route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function req(url: string, method: string, body?: unknown) {
  return new Request(url, { method, body: body != null ? JSON.stringify(body) : undefined }) as any;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(auth).mockReset();
});

describe("Workflow: strategist creates + enforces a SOP -> operator reads it back -> audit comment is visible", () => {
  it("round-trips the SOP id, its title through the join, and the audit comment through a real date filter", async () => {
    const store = new StatefulSupabaseStore();
    store.install();

    // 1. Strategist creates a SOP checklist.
    mockAuth(auth, fakeSession(["strategist"], { userEmail: "strat@xtnl-solutions.com" }));
    const createRes = await createSop(
      req("http://localhost/api/session/sops", "POST", { title: "Entry Discipline", items: ["Check spread", "Confirm bias"], tags: ["entry"] }),
    );
    expect(createRes.status).toBe(201);
    const { row: createdSop } = await createRes.json();
    expect(createdSop.id).toBeTruthy();

    // 2. Strategist enforces exactly that SOP.
    const enforceRes = await postEnforcements(req("http://localhost/api/session/sops/enforcements", "POST", { sopIds: [createdSop.id] }));
    expect(enforceRes.status).toBe(200);
    const enforceJson = await enforceRes.json();
    expect(enforceJson.titles).toEqual(["Entry Discipline"]);

    // 3. Operator reads the enforced set back — proves the sop_id FK +
    //    sop_checklists(*) join round-trips through the real store, not a
    //    pre-shaped mock response.
    mockAuth(auth, fakeSession(["operator"]));
    const readRes = await getEnforcements();
    expect(readRes.status).toBe(200);
    const readJson = await readRes.json();
    expect(readJson.sops).toHaveLength(1);
    expect(readJson.sops[0].id).toBe(createdSop.id);
    expect(readJson.sops[0].title).toBe("Entry Discipline");

    // 4. The enforcement POST's own audit comment is readable back through
    //    comments GET's real `.gte("Entry", cutoff)` 14-day filter — not a
    //    pre-programmed response, an actual date comparison against what
    //    was actually inserted moments ago.
    const commentsRes = await getComments();
    const commentsJson = await commentsRes.json();
    expect(commentsJson.rows.some((c: any) => String(c.content).includes("Entry Discipline"))).toBe(true);
  });

  it("clearing the enforced set (empty sopIds) makes the operator's read return no SOPs", async () => {
    const store = new StatefulSupabaseStore();
    store.install();

    mockAuth(auth, fakeSession(["strategist"]));
    const createRes = await createSop(req("http://localhost/api/session/sops", "POST", { title: "Risk Check", items: ["Confirm size"] }));
    const { row: sop } = await createRes.json();
    await postEnforcements(req("http://localhost/api/session/sops/enforcements", "POST", { sopIds: [sop.id] }));

    // Re-enforce with an empty set — clears it.
    const clearRes = await postEnforcements(req("http://localhost/api/session/sops/enforcements", "POST", { sopIds: [] }));
    expect(clearRes.status).toBe(200);

    mockAuth(auth, fakeSession(["operator"]));
    const readRes = await getEnforcements();
    const readJson = await readRes.json();
    expect(readJson.sops).toEqual([]);
  });
});
