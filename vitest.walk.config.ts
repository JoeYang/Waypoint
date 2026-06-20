import { defineConfig } from "vitest/config";

// The full-surface walk against a LIVE stack (MCP :8848 + REST/WS :8849). It is NOT part of
// `npm test` (the default config only includes `packages/**`) because it needs a running
// server + database — the orchestrator (`npm run test:routine`) provisions those first.
// `forks` pool + serial: the walk owns the project state for its run; a worker thread would
// share globals with nothing here, but forks keep it isolated and let it set process env.
export default defineConfig({
  test: {
    include: ["scripts/__tests__/walk.live.test.ts"],
    environment: "node",
    pool: "forks",
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    retry: process.env.CI ? 1 : 0,
  },
});
