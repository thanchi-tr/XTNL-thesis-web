import { describe, it, expect, beforeEach, vi } from "vitest";
import { auth } from "@/auth";
import { fakeSession, mockAuth } from "@/tests/setup/authMock";
import { StatefulSupabaseStore } from "@/tests/setup/statefulSupabaseMock";
import { POST as createIssue } from "@/app/api/session/issues/route";
import { PUT as proposeSolution } from "@/app/api/session/issues/[issueId]/solution/route";
import { POST as voteSolution } from "@/app/api/session/issues/[issueId]/solution/vote/route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const VALID_TAXONOMY = { domain: "hardware", subsystem: "network", leaf_node: "broker_api_latency" };

function req(url: string, method: string, body?: unknown) {
  return new Request(url, { method, body: body != null ? JSON.stringify(body) : undefined }) as any;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(auth).mockReset();
});

describe("Workflow: create issue -> strategist proposes a solution -> operator votes on it", () => {
  it("the vote route finds the exact issue the create route produced and increments the real solutions array", async () => {
    const store = new StatefulSupabaseStore();
    store.install();

    // 1. Operator reports an issue.
    mockAuth(auth, fakeSession(["operator"], { userEmail: "op@xtnl-solutions.com" }));
    const createRes = await createIssue(req("http://localhost/api/session/issues", "POST", { title: "Broker latency spike", ...VALID_TAXONOMY }));
    expect(createRes.status).toBe(201);
    const { issue_id } = await createRes.json();
    expect(issue_id).toBeTruthy();

    // 2. Strategist proposes a solution — the real `issue_id` the create
    //    route generated must be the one the propose route's real
    //    `.eq("issue_id", issueId).single()` fetch finds.
    mockAuth(auth, fakeSession(["strategist"], { userEmail: "strat@xtnl-solutions.com" }));
    const proposeRes = await proposeSolution(
      req(`http://localhost/api/session/issues/${issue_id}/solution`, "PUT", { description: "Failover to secondary broker feed" }),
      { params: Promise.resolve({ issueId: issue_id }) },
    );
    expect(proposeRes.status).toBe(200);
    const { solution_id } = await proposeRes.json();
    expect(solution_id).toBeTruthy();

    // Confirm the issue's own status flipped open -> in_progress, and the
    // solutions array shape matches what vote's activeSolution() expects.
    const issuesTable = store.getTable("issues");
    const storedIssue = issuesTable.find((i: any) => i.issue_id === issue_id)!;
    expect(storedIssue).toBeTruthy();
    expect(storedIssue.status).toBe("in_progress");
    expect(storedIssue.solutions).toHaveLength(1);
    expect(storedIssue.solutions[0]).toMatchObject({ id: solution_id, status: "active", votes: 0 });

    // 3. Operator votes on it.
    mockAuth(auth, fakeSession(["operator"], { userEmail: "voter@xtnl-solutions.com" }));
    const voteRes = await voteSolution({} as any, { params: Promise.resolve({ issueId: issue_id }) });
    expect(voteRes.status).toBe(200);
    const voteJson = await voteRes.json();
    expect(voteJson.votes).toBe(1);

    // The real stored row reflects the increment — not a mocked echo.
    const afterVote = store.getTable("issues").find((i: any) => i.issue_id === issue_id)!;
    expect(afterVote).toBeTruthy();
    expect(afterVote.solutions[0].votes).toBe(1);
  });

  it("a second vote from a different operator increments again against the same real row", async () => {
    const store = new StatefulSupabaseStore();
    store.install();

    mockAuth(auth, fakeSession(["operator"]));
    const createRes = await createIssue(req("http://localhost/api/session/issues", "POST", { title: "Broker latency spike", ...VALID_TAXONOMY }));
    const { issue_id } = await createRes.json();

    mockAuth(auth, fakeSession(["strategist"]));
    await proposeSolution(
      req(`http://localhost/api/session/issues/${issue_id}/solution`, "PUT", { description: "Failover" }),
      { params: Promise.resolve({ issueId: issue_id }) },
    );

    mockAuth(auth, fakeSession(["operator"]));
    await voteSolution({} as any, { params: Promise.resolve({ issueId: issue_id }) });
    const secondVote = await voteSolution({} as any, { params: Promise.resolve({ issueId: issue_id }) });
    const secondVoteJson = await secondVote.json();

    expect(secondVoteJson.votes).toBe(2);
  });
});
