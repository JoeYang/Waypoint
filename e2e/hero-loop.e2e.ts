import { test, expect, type Page } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// The hero loop end-to-end against the live UI (live-wiring): an agent parks a DECISION over
// MCP; the human opens the project's decision inbox in the browser, answers it in one gesture,
// and it leaves the queue once the answer reaches the backend and the data refetches.
//
// Requires a running stack: `npm run db:up && npm start -w @waypoint/server`. Playwright starts
// the web app pointed at the backend via VITE_WAYPOINT_API_BASE (see playwright.config.ts).
//
// Caveat: this drives the seeded `default` project; it shares one live project/WS, so the cases
// run serially, and it is known-fragile against the auth seam landing (the project id is agreed
// out-of-band between the MCP call and the REST/WS the UI uses) — revisit when auth lands.

const MCP_URL = process.env.WAYPOINT_MCP_URL ?? "http://localhost:8848/mcp";
const PROJECT = "default";
const PROJECT_NAME = "Waypoint"; // the seeded `default` project's display name

test.describe.configure({ mode: "serial" });

interface ToolResult {
  id: string;
  version: number;
}

async function connectMcp(): Promise<Client> {
  const mcp = new Client({ name: "e2e-hero-loop", version: "0.0.0" });
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

// Open the project's decision inbox in the UI (Home → project → Decisions).
async function openInbox(page: Page): Promise<void> {
  await page.goto("/");
  const sidebar = page.getByRole("complementary");
  await sidebar.getByRole("button", { name: new RegExp(PROJECT_NAME, "i") }).click();
  await sidebar.getByRole("button", { name: /Decisions/ }).click();
}

test("an agent parks a decision; the human answers it in the browser and it leaves the queue", async ({
  page,
}) => {
  const stamp = Date.now();
  const prompt = `E2E — which store? (${stamp})`;
  const pick = `Postgres ${stamp}`;

  const mcp = await connectMcp();
  const call = caller(mcp);
  let task: ToolResult | undefined;

  try {
    const goal = await call("create_node", {
      projectId: PROJECT,
      parentId: null,
      kind: "goal",
      title: `E2E goal (${stamp})`,
      sessionId: "e2e",
    });
    const plan = await call("create_node", {
      projectId: PROJECT,
      parentId: goal.id,
      kind: "plan",
      title: `E2E plan (${stamp})`,
      sessionId: "e2e",
    });
    task = await call("create_node", {
      projectId: PROJECT,
      parentId: plan.id,
      kind: "task",
      title: `E2E task (${stamp})`,
      sessionId: "e2e",
    });
    await call("park_ask", {
      projectId: PROJECT,
      nodeId: task.id,
      type: "DECISION",
      prompt,
      required: true,
      risk: "high",
      reversible: false,
      rationale: `retry-safety (${stamp})`,
      options: [
        { label: pick, consequence: "durable" },
        { label: `SQLite ${stamp}`, consequence: "no concurrency" },
      ],
      agentLabel: "e2e-agent",
      sessionId: "e2e",
    });

    // The human opens the inbox and sees the parked decision (risk surfaced from the agent).
    await openInbox(page);
    const card = page.getByRole("button", { name: new RegExp(prompt.replace(/[()?]/g, ".")) });
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Open it and approve; the answer hits the backend and the queue refetches without it.
    await card.click();
    await expect(page.getByRole("heading", { name: new RegExp(prompt.replace(/[()?]/g, ".")) })).toBeVisible();
    await page.getByRole("button", { name: /Approve recommendation|Apply / }).click();

    await openInbox(page);
    await expect(
      page.getByRole("button", { name: new RegExp(prompt.replace(/[()?]/g, ".")) }),
    ).toHaveCount(0, { timeout: 15_000 });
  } finally {
    // Tidy up so the dogfood project is unaffected.
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
