// Seeds Waypoint's own build structure into a running Waypoint server, through the real
// MCP tools (the same surface a coding agent uses). Idempotent: if the goal already
// exists it does nothing. Requires the server running and the project seeded (npm run
// db:up && npm start -w @waypoint/server). Override the URL with WAYPOINT_MCP_URL.
//
// Builds a multi-plan goal→plan→task tree with tasks in varied states and a couple of
// parked decisions, so the project spine (the home screen) is meaningful on first load.
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

const node = (parentId, kind, title) =>
  call("create_node", { projectId: PROJECT, parentId, kind, title, sessionId: SESSION });
const activate = (n) =>
  call("transition", {
    projectId: PROJECT,
    nodeId: n.id,
    to: "ACTIVE",
    expectedVersion: n.version,
    sessionId: SESSION,
  });
const finish = async (parentId, title) => {
  const t = await node(parentId, "task", title);
  await activate(t);
  await call("transition", {
    projectId: PROJECT,
    nodeId: t.id,
    to: "DONE",
    expectedVersion: 2,
    sessionId: SESSION,
  });
};
const running = (parentId, title) => node(parentId, "task", title);

const ctx = await call("get_context", { projectId: PROJECT });
if (ctx.goal) {
  console.log(`dogfood baseline already present (goal: "${ctx.goal}") — nothing to do`);
} else {
  const goal = await node(
    null,
    "goal",
    "Ship the Waypoint MVP (dogfoodable park→answer→unblock loop)",
  );
  await activate(goal);

  // P6 — backend: a done task, a running task, and one blocked on a real decision.
  const p6 = await node(
    goal.id,
    "plan",
    "P6 — Inbox API: REST listing + answer + WebSocket deltas",
  );
  await finish(p6.id, "REST inbox listing");
  await running(p6.id, "answer endpoint");
  const wsTask = await running(p6.id, "WebSocket delta protocol");
  await call("park_ask", {
    projectId: PROJECT,
    nodeId: wsTask.id,
    type: "DECISION",
    prompt: "How should the WS resume after a dropped connection?",
    required: true,
    rationale: "Reconnects must not miss or replay deltas; this sets the client contract.",
    options: [
      { label: "Resume from last seq", consequence: "exact catch-up; needs server retention" },
      { label: "Full resync on reconnect", consequence: "simple; a brief flicker on every drop" },
    ],
    agentLabel: "backend-agent",
    sessionId: SESSION,
  });

  // P7 — web: a done card, a running screen.
  const p7 = await node(goal.id, "plan", "P7 — Web inbox screen (the human answer surface)");
  await finish(p7.id, "decision card");
  await running(p7.id, "inbox screen");

  // P8 — wire-up: a running task and one blocked on a question.
  const p8 = await node(
    goal.id,
    "plan",
    "P8 — Wire the full loop, e2e, README; dogfood on this repo",
  );
  await running(p8.id, "playwright e2e");
  const seedTask = await running(p8.id, "demo seed shape");
  await call("park_ask", {
    projectId: PROJECT,
    nodeId: seedTask.id,
    type: "QUESTION",
    prompt: "How many plans should the demo seed show?",
    required: true,
    suggestedAnswers: ["3 (one per phase)", "5 (richer spine)"],
    agentLabel: "tooling-agent",
    sessionId: SESSION,
  });

  console.log("seeded dogfood baseline: goal + P6/P7/P8 with tasks, 2 parked asks");
}

await client.close();
