// Parks the V2.1 roadmap's key architectural decisions onto Waypoint, through the real MCP
// tools — dogfooding: the decisions about building Waypoint live on Waypoint's own board.
// Idempotent-ish: skips if a decision with the D1 prompt already exists. Requires the server
// running (MCP :8848, REST :8849). Run from the repo root: node scripts/park-roadmap-decisions.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = process.env.WAYPOINT_MCP_URL ?? "http://localhost:8848/mcp";
const REST = process.env.WAYPOINT_REST ?? "http://localhost:8849";
const PROJECT = "default";
const SESSION = "roadmap-planning";

const client = new Client({ name: "roadmap-planner", version: "0.0.0" });
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
    expectedVersion: 1,
    sessionId: SESSION,
  });
// Create a task under a plan and park a DECISION on it.
const decide = async (planId, taskTitle, ask) => {
  const t = await node(planId, "task", taskTitle);
  await activate(t);
  await call("park_ask", {
    projectId: PROJECT,
    nodeId: t.id,
    type: "DECISION",
    required: true,
    agentLabel: "build-agent",
    sessionId: SESSION,
    ...ask,
  });
};

// Locate the goal and the existing slice-3 plan from the live progress tree.
// NOTE: the progress DTO keys nodes by `nodeId` (not `id`, which is the create_node result key).
const progress = await (await fetch(`${REST}/v1/projects/${PROJECT}/progress`)).json();
const goal = progress.goals[0];
if (!goal) throw new Error("no goal — onboard the project first");
const goalId = goal.nodeId;
const slice3Id = goal.plans.find((p) => /async-reentry/i.test(p.title)).nodeId;

const inbox = await (await fetch(`${REST}/v1/projects/${PROJECT}/inbox`)).json();
if (inbox.items.some((i) => /where does .last seen/i.test(i.prompt))) {
  console.log("roadmap decisions already parked — nothing to do");
} else {
  // D1 + D2 → the existing async-reentry slice-3 plan.
  await decide(slice3Id, "Decide: re-entry read-state model", {
    prompt: "Async re-entry: where does 'last seen' read-state live?",
    risk: "medium",
    reversible: true,
    rationale:
      "Drives the digest design. Hybrid avoids a schema + the not-yet-built auth/principal seam and ships now.",
    options: [
      {
        label: "Hybrid stateless cursor (client sends sinceSeq on /digest; server stores nothing)",
        consequence: "ships now, no schema, no auth dependency, upgradeable later — recommended",
      },
      {
        label: "Server-stored last_seen_seq per principal",
        consequence:
          "durable cross-device, but needs the principal/auth seam plumbed first + a migration",
      },
      {
        label: "Client-only localStorage watermark",
        consequence: "simplest, but per-device and digest computed client-side",
      },
    ],
  });
  await decide(slice3Id, "Decide: notification escalation model", {
    prompt: "Async re-entry: notification escalation — derived read-time or stored rows?",
    risk: "medium",
    reversible: true,
    rationale:
      "Tiered/batched notifications need an escalation rule. Derived is stateless; stored remembers what was already pushed.",
    options: [
      {
        label: "Derived read-time from risk × blast_radius × age (no table)",
        consequence:
          "stateless, no migration; 'already escalated' not remembered server-side — recommended to start",
      },
      {
        label: "Stored notification rows with delivered/escalated state",
        consequence: "true batching/dedup/escalation; a new table + lifecycle to maintain",
      },
    ],
  });

  // C3 polish plan → D3.
  const polish = await node(goalId, "plan", "project-map polish (vertical · fold done · PR links)");
  await activate(polish);
  await decide(polish.id, "Decide: task ↔ GitHub PR link mechanism", {
    prompt: "Project map ↔ PR: how do tasks link to GitHub PRs?",
    risk: "medium",
    reversible: true,
    rationale:
      "Schema + MCP-contract change. Reviewer flagged that field + new tool + GitHub API is three 'ask-first' items colliding; start minimal.",
    options: [
      {
        label: "Optional pr_url string on create_node, rendered as a link",
        consequence:
          "minimal — one nullable column, agent supplies the URL; static, no live status — recommended first",
      },
      {
        label: "Add a link_pr MCP tool to attach/update a PR after creation",
        consequence: "cleaner lifecycle; a second MCP contract change",
      },
      {
        label: "GitHub API integration — live PR state (open/merged/checks)",
        consequence:
          "rich status on the map; adds a GitHub dep, token/secret handling, rate limits, a poller",
      },
    ],
  });

  // C4 desktop plan → D4 + D5.
  const desktop = await node(goalId, "plan", "desktop app (Electron shell)");
  await activate(desktop);
  await decide(desktop.id, "Decide: desktop framework", {
    prompt: "Desktop app: Electron or Tauri?",
    risk: "low",
    reversible: false,
    rationale:
      "Project-scope, not a packaging detail: Tauri introduces a Rust toolchain to a TS-only monorepo. Costly to switch later.",
    options: [
      {
        label: "Electron — JS-native, matches the TS-only monorepo",
        consequence: "fastest given the React app; ~150MB binary — recommended",
      },
      {
        label: "Tauri — tiny binary, OS webview",
        consequence:
          "~10MB; but adds a Rust toolchain to a TS-only project (a project-scope shift)",
      },
    ],
  });
  await decide(desktop.id, "Decide: desktop packaging shape", {
    prompt: "Desktop app: what does the Electron shell bundle?",
    risk: "medium",
    reversible: true,
    rationale: "Determines whether the desktop topology matches the cloud end-state or diverges.",
    options: [
      {
        label: "Thin client — wraps the web UI, points at a separately-run backend",
        consequence:
          "matches the cloud topology, smallest; user runs server + Postgres — recommended",
      },
      {
        label: "All-in-one — Electron spawns the Node backend + manages an embedded Postgres",
        consequence: "double-click-and-go; heavy, diverges from the cloud topology",
      },
    ],
  });

  // C5 container plan → D6 + D7.
  const ops = await node(goalId, "plan", "containerize & keep-alive");
  await activate(ops);
  await decide(ops.id, "Decide: container topology", {
    prompt: "Container topology — what runs in the image, and where's Postgres?",
    risk: "medium",
    reversible: true,
    rationale:
      "docker.md favours one-process-per-container; but 'keep it running' on a host suggests a self-contained stack. Note: Docker daemon is unavailable in this dev env — build/run elsewhere.",
    options: [
      {
        label: "Single app image (server + static web), external Postgres",
        consequence: "12-factor, one-process-per-container per docker.md; needs a separate DB",
      },
      {
        label: "Compose stack — app + Postgres + volume, one `docker compose up`",
        consequence:
          "self-contained keep-alive on a host; bundles DB lifecycle — recommended for 'keep it running'",
      },
    ],
  });
  await decide(ops.id, "Decide: production web-serve", {
    prompt: "Production web-serve: who serves the built web UI? (shared by desktop + container)",
    risk: "medium",
    reversible: true,
    rationale:
      "Today the server has no static serving. This gates both the Dockerfile and the Electron URL target. WS heartbeat + resume-since-seq can silently break behind a naive proxy.",
    options: [
      {
        label: "Fastify serves the static build via @fastify/static",
        consequence:
          "one port/process, simplest container + Electron target; couples web + API — recommended",
      },
      {
        label: "nginx reverse proxy — static + proxy API/WS",
        consequence:
          "clean separation; must set Upgrade/Connection/proxy_read_timeout or the WS breaks",
      },
      { label: "Separate SPA deploy (CDN)", consequence: "cloud-native; more infra + CORS config" },
    ],
  });

  console.log("parked 7 roadmap decisions across slice-3 + 3 new plans (polish, desktop, ops)");
}
await client.close();
