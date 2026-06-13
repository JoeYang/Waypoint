import { randomUUID } from "node:crypto";
import { createCore } from "@waypoint/core";
import { createPool } from "./db/pool.js";
import { createPgBackend } from "./db/pg-backend.js";
import { createMcpHttpServer } from "./mcp/http.js";

// Production wiring: real Postgres pool, real clock and id source. Run the compiled output
// (`node dist/main.js`) with DATABASE_URL set; migrate + seed the database first.
const pool = createPool();
const core = createCore({
  uow: createPgBackend(pool).uow,
  clock: { now: () => Date.now() },
  ids: { generate: () => randomUUID() },
});

const port = Number(process.env.WAYPOINT_MCP_PORT ?? "8848");
const server = createMcpHttpServer(core);
server.listen(port, () => {
  console.log(`Waypoint MCP server listening on http://localhost:${port}/mcp`);
});
