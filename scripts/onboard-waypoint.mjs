// Onboards THIS repo (Waypoint) onto Waypoint, through the real MCP tools — the same surface
// a coding agent uses. Models the project's actual current state: storybook-ui (done) and
// live-wiring (done) slices, the in-flight REST CORS fix, and the pending async-reentry slice 3,
// with the genuinely-open decisions parked. Idempotent: does nothing if a goal already exists.
//
// Requires the server running (npm run db:up && npm start -w @waypoint/server). The board should
// be empty first (clear the dogfood) for a clean onboard. Override the URL with WAYPOINT_MCP_URL.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = process.env.WAYPOINT_MCP_URL ?? "http://localhost:8848/mcp";
const PROJECT = "default";
const SESSION = "onboard-waypoint";

const client = new Client({ name: "onboard-waypoint", version: "0.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(MCP_URL)));

const call = async (name, args) => {
  const res = await client.callTool({ name, arguments: args });
  const body = JSON.parse(res.content[0].text);
  if (res.isError) throw new Error(`${name} failed: ${JSON.stringify(body)}`);
  return body;
};

const node = (parentId, kind, title) =>
  call("create_node", { projectId: PROJECT, parentId, kind, title, sessionId: SESSION });
const to = (n, state, expectedVersion) =>
  call("transition", {
    projectId: PROJECT,
    nodeId: n.id,
    to: state,
    expectedVersion,
    sessionId: SESSION,
  });

// done: DRAFT(1) → ACTIVE(2) → DONE(3); running: DRAFT(1) → ACTIVE(2).
const done = async (parentId, title) => {
  const t = await node(parentId, "task", title);
  await to(t, "ACTIVE", 1);
  await to(t, "DONE", 2);
  return t;
};
const running = async (parentId, title) => {
  const t = await node(parentId, "task", title);
  await to(t, "ACTIVE", 1);
  return t;
};

const ctx = await call("get_context", { projectId: PROJECT });
if (ctx.goal) {
  console.log(`already onboarded (goal: "${ctx.goal}") — nothing to do`);
} else {
  const goal = await node(null, "goal", "Waypoint V2 — ship the build");
  await to(goal, "ACTIVE", 1);

  // Slice 1 — storybook-ui: shipped, all tasks done → plan reads "done".
  const ui = await node(goal.id, "plan", "storybook-ui — mock-first UI redesign (10 screens)");
  await to(ui, "ACTIVE", 1);
  await done(ui.id, "10 screens on a swappable WaypointSource seam");
  await done(ui.id, "Cleanup: delete superseded screens, archive OpenSpec change");

  // Slice 2 — live-wiring: backend + seam done; the CORS fix is in flight, blocked on a decision.
  const live = await node(goal.id, "plan", "live-wiring — wire the UI to the live backend");
  await to(live, "ACTIVE", 1);
  await done(
    live.id,
    "Backend endpoints: project list + events (+ agent-supplied risk/reversible)",
  );
  await done(live.id, "Web data seam → live source + DTO→view-model adapter");
  await done(live.id, "Answer wiring (optimistic + reconcile) + live WS push");
  await done(live.id, "Hero-loop e2e + archive live-wiring");
  const cors = await running(live.id, "Fix REST CORS (cross-origin browser fetch)");
  await call("park_ask", {
    projectId: PROJECT,
    nodeId: cors.id,
    type: "DECISION",
    prompt: "How should the REST CORS fix land?",
    required: true,
    risk: "low",
    reversible: true,
    rationale:
      "The fix is done and green (21/21 REST tests) — it just needs a commit home. It's the bug that would have made the hero-loop e2e fail (no Access-Control-Allow-Origin on the API).",
    options: [
      {
        label: "Own branch fix/rest-cors off main",
        consequence: "isolated and reviewable; keeps an unrelated bugfix out of the feature stack",
      },
      {
        label: "Fold into the live-wiring stack",
        consequence: "one fewer PR, but mixes a bugfix into a feature slice",
      },
    ],
    agentLabel: "build-agent",
    sessionId: SESSION,
  });

  // Slice 3 — async re-entry & notifications: genuine unstarted backlog, blocked on a decision.
  const slice3 = await node(goal.id, "plan", "async-reentry & notifications (slice 3)");
  await to(slice3, "ACTIVE", 1);
  const kickoff = await running(
    slice3.id,
    "while-you-were-away digest · re-entry briefing · tiered notifications",
  );
  await call("park_ask", {
    projectId: PROJECT,
    nodeId: kickoff.id,
    type: "DECISION",
    prompt: "Start async-reentry slice 3 now, or keep it parked?",
    required: true,
    risk: "medium",
    reversible: true,
    rationale:
      "Slices 1 (storybook-ui) and 2 (live-wiring) are done. Slice 3 is genuine unstarted backlog with one stale propose commit (2026-06-14); its OpenSpec proposal should be refreshed off main before starting.",
    options: [
      {
        label: "Start slice 3 now",
        consequence:
          "momentum while context is fresh; refresh its OpenSpec proposal off main first",
      },
      {
        label: "Keep it parked",
        consequence: "V2 ships on slices 1+2; slice 3 waits for a dedicated session",
      },
    ],
    agentLabel: "build-agent",
    sessionId: SESSION,
  });

  console.log("onboarded Waypoint: goal + 3 slice plans, 2 open decisions (CORS, slice-3 kickoff)");
}

await client.close();
