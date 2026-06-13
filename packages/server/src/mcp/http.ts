import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Core } from "@waypoint/core";
import { createWaypointMcpServer } from "./server.js";

// Hosts the Waypoint MCP server over the Streamable HTTP transport (not the deprecated
// HTTP+SSE one). Stateless: each request gets a fresh McpServer + transport with no session
// storage — the simplest correct model for a single-user local service. Requests on any
// path other than /mcp get a 404.
async function handle(req: IncomingMessage, res: ServerResponse, core: Core): Promise<void> {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  if (path !== "/mcp") {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
    return;
  }

  const server = createWaypointMcpServer(core);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch {
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "internal_error" }));
    }
  }
}

export function createMcpHttpServer(core: Core): Server {
  return createServer((req, res) => {
    void handle(req, res, core);
  });
}
