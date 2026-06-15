import { test, expect, type Page } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// The hero loop end-to-end (task 7): an agent parks a rich ask over MCP — with a rationale
// and, per intent, per-option consequences / a proposal verdict / suggested answers — the
// human sees the enriched card, answers it in ONE gesture, and the live WebSocket delta
// removes it from the queue. Runs against a running stack (npm run db:up && npm start);
// Playwright starts the web app.

const MCP_URL = process.env.WAYPOINT_MCP_URL ?? "http://localhost:8848/mcp";
const PROJECT = "default";

// These tests share one stack and one live inbox/WS on the `default` project, so they must
// run serially — parallel workers would race on each other's deltas in the shared queue.
test.describe.configure({ mode: "serial" });

type ToolResult = { id: string; version: number };

async function connect(): Promise<Client> {
  const mcp = new Client({ name: "e2e", version: "0.0.0" });
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

// Register an ACTIVE task to hang an ask on; returns its id (caller discards it on teardown).
async function activeTask(
  call: (n: string, a: Record<string, unknown>) => Promise<ToolResult>,
  title: string,
): Promise<string> {
  const node = await call("create_node", {
    projectId: PROJECT,
    parentId: null,
    kind: "task",
    title,
    sessionId: "e2e",
  });
  await call("transition", {
    projectId: PROJECT,
    nodeId: node.id,
    to: "ACTIVE",
    expectedVersion: node.version,
    sessionId: "e2e",
  });
  return node.id;
}

async function discard(
  call: (n: string, a: Record<string, unknown>) => Promise<ToolResult>,
  nodeId: string,
): Promise<void> {
  // The ask-parked node is at version 2 (created → transitioned); discarding bumps to 3.
  await call("transition", {
    projectId: PROJECT,
    nodeId,
    to: "DISCARDED",
    reason: "e2e cleanup",
    expectedVersion: 2,
    sessionId: "e2e",
  });
}

const cardFor = (page: Page, text: string) => page.getByRole("article").filter({ hasText: text });

test("a parked DECISION shows its rationale + consequences and answers in one click", async ({
  page,
}) => {
  const stamp = Date.now();
  const prompt = `E2E — which cache? (${stamp})`;
  const optYes = `Redis ${stamp}`;
  const rationale = `retry-safety matters (${stamp})`;
  const durable = `durable across restarts (${stamp})`;

  const mcp = await connect();
  const call = caller(mcp);
  try {
    const nodeId = await activeTask(call, `E2E decision node ${stamp}`);
    await call("park_ask", {
      projectId: PROJECT,
      nodeId,
      type: "DECISION",
      prompt,
      required: true,
      rationale,
      options: [
        { label: optYes, consequence: durable },
        { label: `In-memory ${stamp}`, consequence: `lost on restart (${stamp})` },
      ],
      agentLabel: "e2e-agent",
      sessionId: "e2e",
    });

    await page.goto("/projects/default/inbox");
    const card = cardFor(page, prompt);
    await expect(card.getByRole("heading", { name: prompt })).toBeVisible({ timeout: 15_000 });
    // The enriched context is on the card so the human answers without re-deriving it.
    await expect(card.getByText(rationale)).toBeVisible();
    await expect(card.getByText(durable)).toBeVisible();

    await card.getByRole("button", { name: optYes }).click();
    await expect(page.getByRole("heading", { name: prompt })).toHaveCount(0, { timeout: 15_000 });

    await discard(call, nodeId);
  } finally {
    await mcp.close();
  }
});

test("a parked PROPOSAL is approved with one click", async ({ page }) => {
  const stamp = Date.now();
  const prompt = `E2E — replace the poller with a webhook? (${stamp})`;

  const mcp = await connect();
  const call = caller(mcp);
  try {
    const nodeId = await activeTask(call, `E2E proposal node ${stamp}`);
    await call("park_ask", {
      projectId: PROJECT,
      nodeId,
      type: "PROPOSAL",
      prompt,
      required: true,
      rationale: `the poller wastes 90% of calls (${stamp})`,
      options: [],
      agentLabel: "e2e-agent",
      sessionId: "e2e",
    });

    await page.goto("/projects/default/inbox");
    const card = cardFor(page, prompt);
    await expect(card.getByRole("heading", { name: prompt })).toBeVisible({ timeout: 15_000 });

    await card.getByRole("button", { name: /approve/i }).click();
    await expect(page.getByRole("heading", { name: prompt })).toHaveCount(0, { timeout: 15_000 });

    await discard(call, nodeId);
  } finally {
    await mcp.close();
  }
});

test("a parked QUESTION is answered by clicking a suggested answer", async ({ page }) => {
  const stamp = Date.now();
  const prompt = `E2E — which region? (${stamp})`;
  const suggestion = `us-east-1 (${stamp})`;

  const mcp = await connect();
  const call = caller(mcp);
  try {
    const nodeId = await activeTask(call, `E2E question node ${stamp}`);
    await call("park_ask", {
      projectId: PROJECT,
      nodeId,
      type: "QUESTION",
      prompt,
      required: true,
      options: [],
      suggestedAnswers: [suggestion, `eu-west-1 (${stamp})`],
      agentLabel: "e2e-agent",
      sessionId: "e2e",
    });

    await page.goto("/projects/default/inbox");
    const card = cardFor(page, prompt);
    await expect(card.getByRole("heading", { name: prompt })).toBeVisible({ timeout: 15_000 });

    await card.getByRole("button", { name: suggestion }).click();
    await expect(page.getByRole("heading", { name: prompt })).toHaveCount(0, { timeout: 15_000 });

    await discard(call, nodeId);
  } finally {
    await mcp.close();
  }
});
