import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";

/**
 * Coverage is scoped to the "critical path" file set covered by this suite
 * (auth-gated writes, SOP/issue/comment workflows, and pure data-verification
 * helpers) rather than the whole app — UI components, pages, and low-risk
 * read-only routes are intentionally out of scope. See the test-suite plan
 * for the rationale behind each inclusion/exclusion.
 */
const CRITICAL_PATH_FILES = [
  "lib/sopValidation.ts",
  "lib/weekKey.ts",
  "lib/kms.ts",
  "lib/solutions.ts",
  "lib/staleCache.ts",
  "app/api/session/sops/route.ts",
  "app/api/session/sops/[sopId]/route.ts",
  "app/api/session/sops/[sopId]/status/route.ts",
  "app/api/session/sops/enforcements/route.ts",
  "app/api/session/comments/route.ts",
  "app/api/session/issues/route.ts",
  "app/api/session/issues/[issueId]/solution/route.ts",
  "app/api/session/issues/[issueId]/solution/vote/route.ts",
  "app/api/session/weekly-signoff/route.ts",
  "app/api/session/analysis-session/route.ts",
  "app/api/session/trigger-pipeline/route.ts",
  "app/api/session/trigger-ingest/route.ts",
];

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      include: CRITICAL_PATH_FILES,
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
});
