import { randomUUID } from "node:crypto";
import { createCore } from "@waypoint/core";
import { createPool } from "./db/pool.js";
import { createPgBackend } from "./db/pg-backend.js";
import { createMcpHttpServer } from "./mcp/http.js";
import { createRestServer } from "./rest/server.js";
import { InboxHub } from "./ws/hub.js";
import { createNotifyingCore } from "./ws/notifying-core.js";
import { createInboxWsServer } from "./ws/server.js";

// Production wiring: real Postgres pool, real clock and id source. Run the compiled output
// (`node dist/main.js`) with DATABASE_URL set; migrate + seed the database first.
//
// One shared InboxHub sits behind a notifying Core, so EVERY committed mutation — whether
// an agent parks an ask over MCP or a human answers over REST — publishes a live delta to
// connected web clients. MCP serves agents on one port; the REST inbox + its WebSocket
// stream serve the human on another (same fastify http server).
const pool = createPool();
const core = createCore({
  uow: createPgBackend(pool).uow,
  clock: { now: () => Date.now() },
  ids: { generate: () => randomUUID() },
});
const hub = new InboxHub(core);
const notifying = createNotifyingCore(core, hub);

const mcpPort = Number(process.env.WAYPOINT_MCP_PORT ?? "8848");
const httpPort = Number(process.env.WAYPOINT_HTTP_PORT ?? "8849");

const mcp = createMcpHttpServer(notifying);
mcp.listen(mcpPort, () => {
  console.log(`Waypoint MCP server listening on http://localhost:${mcpPort}/mcp`);
});

const rest = createRestServer(notifying, {
  corsOrigin: process.env.WAYPOINT_CORS_ORIGIN,
  // In the prod container the server also serves the built web SPA (D7); WAYPOINT_WEB_ROOT
  // points at the copied `vite build` output. Unset in dev, where Vite serves the web.
  webRoot: process.env.WAYPOINT_WEB_ROOT,
});
createInboxWsServer(hub, rest.server);
rest
  .listen({ port: httpPort, host: "0.0.0.0" })
  .then((address) => {
    console.log(`Waypoint inbox API + WS listening on ${address}`);
  })
  .catch((err: unknown) => {
    console.error("failed to start inbox API", err);
    process.exit(1);
  });

// Graceful shutdown: the orchestrator sends SIGTERM before SIGKILL. Close Fastify (and the
// WebSocket server attached to it) so in-flight requests drain and sockets close cleanly.
const shutdown = (signal: string): void => {
  console.log(`${signal} received — draining connections`);
  rest
    .close()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
