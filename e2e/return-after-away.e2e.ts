import { test, expect, type Page } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// Return-after-away end-to-end (re-entry slice 3): an agent parks a high-blast-radius decision
// over MCP while the human is away; the human returns to the project map and the "While you were
// away" banner briefs them — the waiting ask appears in it — and dismisses on demand.
//
// Requires a running stack (same as hero-loop.e2e.ts): `npm run db:up && npm start -w
// @waypoint/server`; Playwright starts the web app pointed at the backend via the config.
//
// Caveat: drives the seeded `default` project over one live project/WS, so cases run serially;
// known-fragile against the auth seam (the project id is agreed out-of-band) — revisit with auth.

const MCP_URL = process.env.WAYPOINT_MCP_URL ?? "http://localhost:8848/mcp";
const PROJECT = "default";
const PROJECT_NAME = "Waypoint";

test.describe.configure({ mode: "serial" });

interface ToolResult {
  id: string;
  version: number;
}

async function connectMcp(): Promise<Client> {
  const mcp = new Client({ name: "e2e-return-after-away", version: "0.0.0" });
  await mcp.connect(new StreamableHTTPClientTransport(new URL(MCP_URL)));
  return mcp;
}

function caller(mcp: Client) {
  return async (name: string, args: Record<string, unknown>): Promise<ToolResult> => {
    const res = (await mcp.callTool({ name, arguments: args })) as CallToolResult;
    const body = JSON.parse((res.content[0] as { text: string }).text) as Record<string, unknown>;
    if (res.isError) throw new Error(`${name}: ${JSON.stringify(body)}`);
    return body as ToolResult;
  };
}

// Open the project's map (the spine) where the while-you-were-away banner sits: Home → project →
// Project map.
async function openMap(page: Page): Promise<void> {
  await page.goto("/");
  const sidebar = page.getByRole("complementary");
  await sidebar.getByRole("button", { name: new RegExp(PROJECT_NAME, "i") }).click();
  await sidebar.getByRole("button", { name: /Project map/i }).click();
}

test("a human returning to the spine is briefed by the while-you-were-away banner", async ({
  page,
}) => {
  const stamp = Date.now();
  const taskTitle = `E2E away task (${stamp})`;
  const prompt = `E2E away — which cache? (${stamp})`;

  const mcp = await connectMcp();
  const call = caller(mcp);
  let task: ToolResult | undefined;

  try {
    const goal = await call("create_node", {
      projectId: PROJECT,
      parentId: null,
      kind: "goal",
      title: `E2E away goal (${stamp})`,
      sessionId: "e2e",
    });
    const plan = await call("create_node", {
      projectId: PROJECT,
      parentId: goal.id,
      kind: "plan",
      title: `E2E away plan (${stamp})`,
      sessionId: "e2e",
    });
    task = await call("create_node", {
      projectId: PROJECT,
      parentId: plan.id,
      kind: "task",
      title: taskTitle,
      sessionId: "e2e",
    });
    // A parked ask makes the task a "waiting" item in the digest → the banner has content.
    await call("park_ask", {
      projectId: PROJECT,
      nodeId: task.id,
      type: "DECISION",
      prompt,
      required: true,
      risk: "high",
      reversible: false,
      options: [
        { label: `Redis ${stamp}`, consequence: "shared" },
        { label: `In-process ${stamp}`, consequence: "simple" },
      ],
      agentLabel: "e2e-agent",
      sessionId: "e2e",
    });

    // The human returns to the spine — the banner briefs them, listing the waiting task.
    await openMap(page);
    const banner = page.getByRole("region", { name: /while you were away/i });
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner.getByText(new RegExp(taskTitle.replace(/[()]/g, ".")))).toBeVisible();

    // Dismissing acks the cursor and removes the banner for this visit.
    await banner.getByRole("button", { name: /dismiss/i }).click();
    await expect(page.getByRole("region", { name: /while you were away/i })).toHaveCount(0, {
      timeout: 15_000,
    });
  } finally {
    if (task) {
      await call("transition", {
        projectId: PROJECT,
        nodeId: task.id,
        to: "DISCARDED",
        reason: "e2e cleanup",
        expectedVersion: 1,
        sessionId: "e2e",
      }).catch(() => {});
    }
    await mcp.close();
  }
});
