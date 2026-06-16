// @waypoint/server — adapters: MCP (Streamable HTTP), REST, WebSocket; Postgres
// repository implementing core's ports; the live-inbox event hub. Depends on
// @waypoint/core + @waypoint/shared.
export { createWaypointMcpServer, WAYPOINT_INSTRUCTIONS } from "./mcp/server.js";
export { createMcpHttpServer } from "./mcp/http.js";
export { createRestServer } from "./rest/server.js";
export { InboxHub } from "./ws/hub.js";
export type { Send, Subscription } from "./ws/hub.js";
export { createNotifyingCore } from "./ws/notifying-core.js";
export { createInboxWsServer } from "./ws/server.js";
