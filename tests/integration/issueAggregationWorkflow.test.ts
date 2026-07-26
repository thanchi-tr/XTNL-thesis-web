import { describe, it, expect, beforeEach, vi } from "vitest";
import { auth } from "@/auth";
import { fakeSession, mockAuth } from "@/tests/setup/authMock";
import { StatefulSupabaseStore } from "@/tests/setup/statefulSupabaseMock";
import { POST as createIssue, GET as getIssues } from "@/app/api/session/issues/route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const VALID_TAXONOMY = { domain: "hardware", subsystem: "network", leaf_node: "broker_api_latency" };

function req(url: string, method: string, body?: unknown) {
  return new Request(url, { method, body: body != null ? JSON.stringify(body) : undefined }) as any;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(auth).mockReset();
});

describe("Workflow: issue GET aggregates real deployment/tool rows keyed off the created issue's real id", () => {
  it("attaches a real deployment + tool row via the in-JS join, not pre-shaped mock data", async () => {
    const store = new StatefulSupabaseStore();
    store.install();

    mockAuth(auth, fakeSession(["operator"]));
    const createRes = await createIssue(req("http://localhost/api/session/issues", "POST", { title: "Broker latency spike", ...VALID_TAXONOMY }));
    const { issue_id } = await createRes.json();

    // Seed a tool + a deployment referencing the REAL issue_id the create
    // route generated — proving the GET route's Map-based join keys off
    // real stored ids, not a value a test happened to pre-program.
    store.seed("digital_tools", [{ tool_id: "t1", name: "Retest Discipline Checklist", category: "process", version: "1.0", deprecated: false }]);
    store.seed("tool_deployments", [{
      id: 1, issue_id, tool_id: "t1", deployed_at: "2026-01-02T00:00:00Z",
      deployed_by: "strat@xtnl-solutions.com", active: true, relapses: 0,
    }]);

    const readRes = await getIssues();
    expect(readRes.status).toBe(200);
    const issues = await readRes.json();

    const created = issues.find((i: any) => i.issue_id === issue_id);
    expect(created).toBeTruthy();
    expect(created.deployments).toHaveLength(1);
    expect(created.deployments[0]).toMatchObject({ tool_id: "t1", tool_name: "Retest Discipline Checklist", active: true });
  });

  it("a deployment referencing an unmatched tool_id falls back to 'unknown tool' rather than crashing", async () => {
    const store = new StatefulSupabaseStore();
    store.install();

    mockAuth(auth, fakeSession(["operator"]));
    const createRes = await createIssue(req("http://localhost/api/session/issues", "POST", { title: "Orphan deployment case", ...VALID_TAXONOMY }));
    const { issue_id } = await createRes.json();

    store.seed("tool_deployments", [{ id: 1, issue_id, tool_id: "does-not-exist", deployed_at: "2026-01-02T00:00:00Z", deployed_by: "x", active: false, relapses: 2 }]);

    const readRes = await getIssues();
    const issues = await readRes.json();
    const created = issues.find((i: any) => i.issue_id === issue_id);

    expect(created.deployments[0].tool_name).toBe("unknown tool");
  });
});
