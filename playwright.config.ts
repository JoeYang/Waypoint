import { defineConfig, devices } from "@playwright/test";

// End-to-end tests for the full park → answer → unblock loop. The web dev server
// and local backend are wired up in task group 7; until then the suite is empty.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.WAYPOINT_WEB_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
