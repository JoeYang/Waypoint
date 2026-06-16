import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createCore } from "@waypoint/core";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "@waypoint/core/testing";
import { createMcpHttpServer } from "../http.js";

// Exercises the real Streamable HTTP wiring (backed by the in-memory fakes, so no DB).
describe("Waypoint MCP over Streamable HTTP", () => {
  let httpServer: Server;
  let client: Client;

  beforeAll(async () => {
    const backend = new InMemoryBackend();
    backend.seedProject({ id: "default", name: "Waypoint", createdAt: 0 });
    const core = createCore({
      uow: backend.uow,
      clock: new FakeClock(1_000),
      ids: new FakeIdGenerator("x"),
    });
    httpServer = createMcpHttpServer(core);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const { port } = httpServer.address() as AddressInfo;

    client = new Client({ name: "http-test", version: "0.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://localhost:${port}/mcp`)));
  });

  afterAll(async () => {
    await client.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("completes the handshake, advertises instructions, and lists tools over HTTP", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("get_context");
    expect(client.getInstructions()).toContain("get_context");
  });

  it("serves a tool call over HTTP", async () => {
    const res = (await client.callTool({
      name: "get_context",
      arguments: { projectId: "default" },
    })) as CallToolResult;
    expect(res.isError).toBeFalsy();
  });
});
