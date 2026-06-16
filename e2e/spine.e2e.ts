import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// Slice 2 end-to-end: the project spine is the home. An agent registers a goal→plan→task
// tree and parks a decision on a task; the human opens the spine, sees the goal and the
// decision card in place on the task it blocks, answers it in one click, and the live WS
// signal refetches the spine so the card leaves. Runs against a running stack.

const MCP_URL = process.env.WAYPOINT_MCP_URL ?? "http://localhost:8848/mcp";
const PROJECT = "default";

test.describe.configure({ mode: "serial" });

test("the spine home shows a parked decision in place and answers it live", async ({ page }) => {
  const stamp = Date.now();
  const goalTitle = `E2E spine goal (${stamp})`;
  const prompt = `E2E — which store? (${stamp})`;
  const pick = `Postgres ${stamp}`;

  const mcp = new Client({ name: "e2e-spine", version: "0.0.0" });
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

  try {
    const goal = await call("create_node", {
      projectId: PROJECT,
      parentId: null,
      kind: "goal",
      title: goalTitle,
      sessionId: "e2e",
    });
    const plan = await call("create_node", {
      projectId: PROJECT,
      parentId: goal.id,
      kind: "plan",
      title: `plan ${stamp}`,
      sessionId: "e2e",
    });
    const task = await call("create_node", {
      projectId: PROJECT,
      parentId: plan.id,
      kind: "task",
      title: `task ${stamp}`,
      sessionId: "e2e",
    });
    await call("park_ask", {
      projectId: PROJECT,
      nodeId: task.id,
      type: "DECISION",
      prompt,
      required: true,
      rationale: `retry-safety (${stamp})`,
      options: [
        { label: pick, consequence: "durable" },
        { label: `SQLite ${stamp}`, consequence: "no concurrency" },
      ],
      agentLabel: "e2e-agent",
      sessionId: "e2e",
    });

    // The human opens the spine (the home) and finds the goal + the card in place.
    await page.goto("/");
    await expect(page.getByRole("heading", { name: goalTitle })).toBeVisible({ timeout: 15_000 });
    const card = page.getByRole("article").filter({ hasText: prompt });
    await expect(card.getByRole("heading", { name: prompt })).toBeVisible();
    await expect(card.getByText(`retry-safety (${stamp})`)).toBeVisible();

    // Answer in place; the live WS signal refetches the spine and the card leaves.
    await card.getByRole("button", { name: pick }).click();
    await expect(page.getByRole("heading", { name: prompt })).toHaveCount(0, { timeout: 15_000 });

    // Tidy up so the dogfood spine is unaffected.
    await call("transition", {
      projectId: PROJECT,
      nodeId: task.id,
      to: "DISCARDED",
      reason: "e2e cleanup",
      expectedVersion: 1,
      sessionId: "e2e",
    });
    await call("transition", {
      projectId: PROJECT,
      nodeId: plan.id,
      to: "DISCARDED",
      reason: "e2e cleanup",
      expectedVersion: 1,
      sessionId: "e2e",
    });
    await call("transition", {
      projectId: PROJECT,
      nodeId: goal.id,
      to: "DISCARDED",
      reason: "e2e cleanup",
      expectedVersion: 1,
      sessionId: "e2e",
    });
  } finally {
    await mcp.close();
  }
});
