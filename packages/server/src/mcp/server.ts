import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  GetContextInputSchema,
  CreateNodeInputSchema,
  TransitionInputSchema,
  parkAskInputShape,
} from "@waypoint/shared";
import { type Core, WaypointError, StaleVersionError } from "@waypoint/core";

// Advertised in InitializeResult.instructions — the portable, harness-agnostic bootstrap
// that tells any connecting session (Claude Code, Codex, OpenCode) how to use Waypoint.
export const WAYPOINT_INSTRUCTIONS = [
  "Waypoint is an async decision inbox. Before doing other work, call `get_context` with",
  'the project id (use "default") to load the goal, the open asks, and recent decisions.',
  "When you reach a fork that needs a human decision, DO NOT guess: park it with",
  "`park_ask` and keep working on whatever is still unblocked — the human answers",
  "asynchronously. Give the human everything needed to answer in one glance: a `rationale`",
  "(why this needs deciding now), and for a DECISION a `consequence` on each option (what",
  "choosing it commits to). A DECISION ask must include at least two options; for a QUESTION,",
  "offer `suggestedAnswers` so the human can pick rather than type. Set an `agentLabel` so",
  "the human sees who parked it. An adjusted proposal comes back as an approval carrying a",
  "constraint note in recent decisions — proceed under it, do not re-ask.",
  "Use `create_node` to register work and `transition` to move a node along the spine",
  "DRAFT → ACTIVE → DONE/DISCARDED (pass expected_version). Pass your session id where",
  "available so changes are attributed.",
].join(" ");

const ok = (data: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data) }],
});

// Domain errors become tool errors (isError) carrying the typed code so the agent can
// react — e.g. STALE_VERSION includes the current version to re-read. Unexpected errors
// propagate so the SDK surfaces them as protocol errors.
const fail = (err: unknown): CallToolResult => {
  if (err instanceof WaypointError) {
    const body: Record<string, unknown> = { code: err.code, message: err.message };
    if (err instanceof StaleVersionError) body.actualVersion = err.actualVersion;
    return { isError: true, content: [{ type: "text", text: JSON.stringify(body) }] };
  }
  throw err;
};

// Builds the Waypoint MCP server over any transport. Tools are thin adapters over core;
// inputs are validated against the shared schemas by the SDK before each handler runs.
export function createWaypointMcpServer(core: Core): McpServer {
  const server = new McpServer(
    { name: "waypoint", version: "0.0.0" },
    { instructions: WAYPOINT_INSTRUCTIONS },
  );

  server.registerTool(
    "get_context",
    {
      description: "Load the project goal, open asks, and recent decisions. Call this first.",
      inputSchema: GetContextInputSchema.shape,
    },
    async (args) => {
      try {
        return ok(await core.getContext(args.projectId));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "create_node",
    {
      description: "Register a unit of work (goal/plan/step/task) in the project tree.",
      inputSchema: CreateNodeInputSchema.shape,
    },
    async (args) => {
      try {
        const node = await core.createNode(args);
        return ok({ id: node.id, version: node.version });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "park_ask",
    {
      description:
        "Park a decision/question/proposal for a human instead of guessing. Include a rationale " +
        "and, for a DECISION (needs ≥2 options), a consequence per option; offer suggestedAnswers " +
        "for a QUESTION and an agentLabel for provenance.",
      inputSchema: parkAskInputShape,
    },
    async (args) => {
      try {
        const ask = await core.parkAsk(args);
        return ok({ id: ask.id, version: ask.version });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "transition",
    {
      description: "Move a node along the status spine (DRAFT→ACTIVE→DONE/DISCARDED).",
      inputSchema: TransitionInputSchema.shape,
    },
    async (args) => {
      try {
        const node = await core.transition(args);
        return ok({ id: node.id, status: node.status, version: node.version });
      } catch (err) {
        return fail(err);
      }
    },
  );

  return server;
}
