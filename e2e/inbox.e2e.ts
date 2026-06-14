import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// The hero loop end-to-end (task 7.4): an agent parks a decision over MCP, the human sees
// it in the inbox, answers it, and it leaves the queue — driven by the live WebSocket delta.
// Runs against a running stack (npm run db:up && npm start); Playwright starts the web app.

const MCP_URL = process.env.WAYPOINT_MCP_URL ?? "http://localhost:8848/mcp";
const PROJECT = "default";

test("park via MCP appears in the inbox, then answering removes it live", async ({ page }) => {
  const stamp = Date.now();
  const prompt = `E2E — which cache? (${stamp})`;
  const optYes = `Redis ${stamp}`;

  const mcp = new Client({ name: "e2e", version: "0.0.0" });
  await mcp.connect(new StreamableHTTPClientTransport(new URL(MCP_URL)));
  const call = async (
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ id: string; version: number }> => {
    const res = (await mcp.callTool({ name, arguments: args })) as CallToolResult;
    const body = JSON.parse((res.content[0] as { text: string }).text) as Record<string, unknown>;
    if (res.isError) throw new Error(`${name}: ${JSON.stringify(body)}`);
    return body as { id: string; version: number };
  };

  // Agent: register work, activate it, and park a decision instead of guessing.
  const node = await call("create_node", {
    projectId: PROJECT,
    parentId: null,
    kind: "task",
    title: `E2E node ${stamp}`,
    sessionId: "e2e",
  });
  await call("transition", {
    projectId: PROJECT,
    nodeId: node.id,
    to: "ACTIVE",
    expectedVersion: node.version,
    sessionId: "e2e",
  });
  await call("park_ask", {
    projectId: PROJECT,
    nodeId: node.id,
    type: "DECISION",
    prompt,
    required: true,
    options: [optYes, `In-memory ${stamp}`],
    sessionId: "e2e",
  });

  // Human: open the inbox and find the card.
  await page.goto("/");
  const card = page.getByRole("article").filter({ hasText: prompt });
  await expect(card.getByRole("heading", { name: prompt })).toBeVisible({ timeout: 15_000 });

  // Answer it; the live WebSocket delta removes the card from the queue.
  await card.getByRole("button", { name: optYes }).click();
  await expect(page.getByRole("heading", { name: prompt })).toHaveCount(0, { timeout: 15_000 });

  // Tidy up so the dogfood inbox is unaffected by the test run.
  await call("transition", {
    projectId: PROJECT,
    nodeId: node.id,
    to: "DISCARDED",
    reason: "e2e cleanup",
    expectedVersion: 2,
    sessionId: "e2e",
  });
  await mcp.close();
});
