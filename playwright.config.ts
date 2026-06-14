import { defineConfig, devices } from "@playwright/test";

// A dedicated port for the Waypoint web app — the default Vite port is often taken by a
// neighbouring project's dev server, which reuseExistingServer would wrongly adopt.
const WEB_PORT = process.env.WAYPOINT_WEB_PORT ?? "5273";
const WEB_URL = process.env.WAYPOINT_WEB_URL ?? `http://localhost:${WEB_PORT}`;

// End-to-end tests for the full park → answer → unblock loop. The test drives an MCP
// client (agent) and a browser (human) against a running stack. Playwright starts the web
// dev server; the inbox API + Postgres are expected up (npm run db:up && npm start) and are
// reused if already running.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: WEB_URL,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -w @waypoint/web",
    url: WEB_URL,
    env: { WAYPOINT_WEB_PORT: WEB_PORT },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
