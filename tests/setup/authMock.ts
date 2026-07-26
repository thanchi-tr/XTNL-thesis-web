import { vi } from "vitest";
import type { Session } from "next-auth";

/**
 * Each test file must declare its own hoisted mock (vitest only hoists
 * `vi.mock` calls written directly in the test file):
 *
 *   vi.mock("@/auth", () => ({ auth: vi.fn() }));
 *
 * then, in a test:
 *
 *   import { auth } from "@/auth";
 *   import { fakeSession, mockAuth } from "@/tests/setup/authMock";
 *   mockAuth(auth, fakeSession(["strategist"]));
 */

type AuthedSession = Session & { twoFactorVerified: boolean; userEmail: string; userName: string; roles: string[] };

export function fakeSession(roles: string[], overrides: Partial<AuthedSession> = {}): AuthedSession {
  return {
    twoFactorVerified: true,
    userEmail: "user@xtnl-solutions.com",
    userName: "Test User",
    roles,
    ...overrides,
  } as AuthedSession;
}

export function mockAuth(authFn: unknown, session: AuthedSession | null) {
  vi.mocked(authFn as (...a: unknown[]) => unknown).mockResolvedValue(session);
}
