// Seeds Waypoint's own build structure into a running Waypoint server, through the real
// MCP tools (the same surface a coding agent uses). Idempotent: if the goal already
// exists it does nothing. Requires the server running and the project seeded (npm run
// db:up && npm start -w @waypoint/server). Override the URL with WAYPOINT_MCP_URL.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = process.env.WAYPOINT_MCP_URL ?? "http://localhost:8848/mcp";
const PROJECT = "default";
const SESSION = "dogfood-seed";

const client = new Client({ name: "dogfood-seed", version: "0.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(MCP_URL)));

const call = async (name, args) => {
  const res = await client.callTool({ name, arguments: args });
  const body = JSON.parse(res.content[0].text);
  if (res.isError) throw new Error(`${name} failed: ${JSON.stringify(body)}`);
  return body;
};

const ctx = await call("get_context", { projectId: PROJECT });
if (ctx.goal) {
  console.log(`dogfood baseline already present (goal: "${ctx.goal}") — nothing to do`);
} else {
  const goal = await call("create_node", {
    projectId: PROJECT,
    parentId: null,
    kind: "goal",
    title: "Ship the Waypoint MVP (dogfoodable park→answer→unblock loop)",
    sessionId: SESSION,
  });
  await call("transition", {
    projectId: PROJECT,
    nodeId: goal.id,
    to: "ACTIVE",
    expectedVersion: goal.version,
    sessionId: SESSION,
  });
  for (const title of [
    "P6 — Inbox API: REST listing + answer + WebSocket deltas",
    "P7 — Web inbox screen (the human answer surface)",
    "P8 — Wire the full loop, e2e, README; dogfood on this repo",
  ]) {
    await call("create_node", { projectId: PROJECT, parentId: goal.id, kind: "plan", title, sessionId: SESSION });
  }
  console.log("seeded dogfood baseline: goal + P6/P7/P8 (ACTIVE)");
}

await client.close();
