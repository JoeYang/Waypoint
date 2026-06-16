import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createCore, BackendUnavailableError, type Core, type UnitOfWork } from "@waypoint/core";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "@waypoint/core/testing";
import { createWaypointMcpServer } from "../server.js";

const PROJECT = "default";

const bodyOf = (res: CallToolResult): Record<string, unknown> =>
  JSON.parse((res.content[0] as { text: string }).text) as Record<string, unknown>;

async function connect(core: Core): Promise<Client> {
  const server = createWaypointMcpServer(core);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test-agent", version: "0.0.0" });
  await client.connect(clientTransport);
  return client;
}

describe("Waypoint MCP server", () => {
  let backend: InMemoryBackend;
  let core: Core;
  let client: Client;

  beforeEach(async () => {
    backend = new InMemoryBackend();
    backend.seedProject({ id: PROJECT, name: "Waypoint", createdAt: 0 });
    core = createCore({
      uow: backend.uow,
      clock: new FakeClock(1_000),
      ids: new FakeIdGenerator("x"),
    });
    client = await connect(core);
  });

  afterEach(async () => {
    await client.close();
  });

  const call = (name: string, args: Record<string, unknown>): Promise<CallToolResult> =>
    client.callTool({ name, arguments: args }) as Promise<CallToolResult>;

  it("completes the handshake and lists the four tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "create_node",
      "get_context",
      "park_ask",
      "transition",
    ]);
  });

  it("advertises the get_context-first bootstrap in instructions", () => {
    expect(client.getInstructions()).toContain("get_context");
  });

  it("advertises decision-context guidance (rationale, consequences) in instructions", () => {
    const instructions = client.getInstructions() ?? "";
    expect(instructions).toMatch(/rationale/i);
    expect(instructions).toMatch(/consequence/i);
  });

  it("directs agents to declare risk and reversibility in instructions", () => {
    const instructions = client.getInstructions() ?? "";
    expect(instructions).toMatch(/risk/i);
    expect(instructions).toMatch(/reversible/i);
  });

  it("parks an ask carrying the agent's declared risk and reversibility", async () => {
    const node = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "T",
    });
    const parked = await call("park_ask", {
      projectId: PROJECT,
      nodeId: node.id,
      type: "DECISION",
      prompt: "Drop the legacy table?",
      required: true,
      options: ["Drop", "Keep"],
      risk: "high",
      reversible: false,
    });
    const ask = await backend.asks.findById(PROJECT, bodyOf(parked).id as string);
    expect(ask?.risk).toBe("high");
    expect(ask?.reversible).toBe(false);
  });

  it("rejects a park_ask with an invalid risk at the boundary", async () => {
    const node = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "T",
    });
    const res = await call("park_ask", {
      projectId: PROJECT,
      nodeId: node.id,
      type: "QUESTION",
      prompt: "Which?",
      required: true,
      options: [],
      risk: "critical",
    });
    expect(res.isError).toBe(true);
  });

  it("parks an ask carrying rationale, per-option consequences, and provenance", async () => {
    const node = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "T",
    });
    const parked = await call("park_ask", {
      projectId: PROJECT,
      nodeId: node.id,
      type: "DECISION",
      prompt: "Postgres or SQLite?",
      required: true,
      rationale: "retry-safety matters for the queue",
      options: [
        { label: "Postgres", consequence: "stable across retries" },
        { label: "SQLite", consequence: "no concurrency" },
      ],
      agentLabel: "checkout-agent",
      sessionId: "sess-1",
    });
    const id = bodyOf(parked).id as string;
    const ask = await backend.asks.findById(PROJECT, id);
    expect(ask?.rationale).toBe("retry-safety matters for the queue");
    expect(ask?.options[1]).toMatchObject({ label: "SQLite", consequence: "no concurrency" });
    expect(ask?.agentLabel).toBe("checkout-agent");
  });

  it("returns a context pack for the project", async () => {
    await core.createNode({ projectId: PROJECT, parentId: null, kind: "goal", title: "Ship MVP" });
    const res = await call("get_context", { projectId: PROJECT });
    expect(res.isError).toBeFalsy();
    expect(bodyOf(res)).toMatchObject({ goal: "Ship MVP", project: { id: PROJECT } });
  });

  it("returns a typed not-found for an unknown project", async () => {
    const res = await call("get_context", { projectId: "ghost" });
    expect(res.isError).toBe(true);
    expect(bodyOf(res).code).toBe("NOT_FOUND");
  });

  it("creates a node and records session provenance", async () => {
    const res = await call("create_node", {
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "Pick a DB",
      sessionId: "sess-1",
    });
    const id = bodyOf(res).id as string;
    expect(bodyOf(res).version).toBe(1);
    const node = await backend.nodes.findById(PROJECT, id);
    expect(node?.sessionId).toBe("sess-1");
  });

  it("parks an ask and transitions a node along the spine", async () => {
    const node = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "T",
    });
    const parked = await call("park_ask", {
      projectId: PROJECT,
      nodeId: node.id,
      type: "DECISION",
      prompt: "Postgres or SQLite?",
      required: true,
      options: ["Postgres", "SQLite"],
    });
    expect(bodyOf(parked)).toMatchObject({ version: 1 });

    const moved = await call("transition", {
      projectId: PROJECT,
      nodeId: node.id,
      to: "ACTIVE",
      expectedVersion: 1,
    });
    expect(bodyOf(moved)).toMatchObject({ status: "ACTIVE", version: 2 });
  });

  it("surfaces an adjusted proposal's constraint to the agent via get_context", async () => {
    const node = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "T",
    });
    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId: node.id,
      type: "PROPOSAL",
      prompt: "Replace the poller with a webhook?",
      required: true,
      options: [],
    });
    await core.answer({
      projectId: PROJECT,
      askId: ask.id,
      expectedVersion: 1,
      proposalVerdict: "adjust",
      adjustmentNote: "keep the poller for 30d",
    });

    const res = await call("get_context", { projectId: PROJECT });
    const pack = bodyOf(res) as { recentDecisions: Array<{ resolution: string }> };
    expect(pack.recentDecisions.map((d) => d.resolution)).toContain("keep the poller for 30d");
  });

  it("rejects an illegal spine move with a validation error", async () => {
    const node = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "T",
    });
    const res = await call("transition", {
      projectId: PROJECT,
      nodeId: node.id,
      to: "DONE",
      expectedVersion: 1,
    });
    expect(res.isError).toBe(true);
    expect(bodyOf(res).code).toBe("VALIDATION");
  });

  it("rejects a stale transition and reports the current version", async () => {
    const node = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "T",
    });
    const res = await call("transition", {
      projectId: PROJECT,
      nodeId: node.id,
      to: "ACTIVE",
      expectedVersion: 99,
    });
    expect(res.isError).toBe(true);
    expect(bodyOf(res)).toMatchObject({ code: "STALE_VERSION", actualVersion: 1 });
  });

  it("rejects malformed tool arguments before touching the domain", async () => {
    const result = await call("create_node", { projectId: PROJECT, parentId: null, kind: "task" })
      .then((res) => ({ res }))
      .catch((err: unknown) => ({ err }));
    // The SDK validates inputSchema: either it throws, or returns an error result.
    if ("res" in result) {
      expect(result.res.isError).toBe(true);
    } else {
      expect(result.err).toBeDefined();
    }
  });
});

describe("Waypoint MCP server — backend unavailable", () => {
  it("surfaces a typed BACKEND_UNAVAILABLE tool error", async () => {
    const failingUow: UnitOfWork = {
      run: async () => {
        throw new BackendUnavailableError("database down");
      },
    };
    const core = createCore({
      uow: failingUow,
      clock: new FakeClock(1_000),
      ids: new FakeIdGenerator("x"),
    });
    const client = await connect(core);
    try {
      const res = (await client.callTool({
        name: "get_context",
        arguments: { projectId: PROJECT },
      })) as CallToolResult;
      expect(res.isError).toBe(true);
      expect(bodyOf(res).code).toBe("BACKEND_UNAVAILABLE");
    } finally {
      await client.close();
    }
  });
});
