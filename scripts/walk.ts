// The full-surface walk: one ordered journey over Waypoint's LIVE wire (MCP + REST + WS)
// that exercises every externally observable capability and asserts the documented contract
// at each step. It is the daily test routine's acceptance gate — "the whole thing works".
//
// Scope is deliberately bounded to what the external surface actually exposes:
//   • MCP tools (4): get_context, create_node, park_ask, transition
//   • REST routes (6 + health): /projects, /inbox, /progress, /events, /answer, /healthz
//   • WS: snapshot + delta (upsert on park, removal on answer)
//   • node lifecycle DRAFT→ACTIVE→DONE and →DISCARDED; ask OPEN→ANSWERED (3 types)
//   • optimistic-concurrency STALE_VERSION, NOT_FOUND, cross-project isolation
// NOT walked (no wire surface exposes them today — covered at the unit layer instead):
//   • ask OPEN→ASSUMED→CONFIRMED/OVERTURNED (core use-cases, unrouted)
//   • WS resync (needs >256 events to evict the ring; unit-tested with a small retain window)
//
// Run standalone against a running stack (`npm run db:up && npm start -w @waypoint/server`):
//   node --experimental-strip-types scripts/walk.ts        (or: npm run walk)
// Or imported by vitest.walk.config.ts as a forks-pool suite. Idempotent against a fresh seed;
// best-effort cleanup of what it creates so a shared dev project is not polluted.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { pathToFileURL } from "node:url";

export interface WalkOptions {
  mcpUrl?: string;
  rest?: string;
  ws?: string;
  project?: string;
}

export interface WalkResult {
  covered: string[];
  durationMs: number;
}

type Rec = Record<string, unknown>;

class WalkError extends Error {}

// ─── tiny assertion + coverage tracking ────────────────────────────────────────────────
// Every surface we intend to exercise is declared up front; the walk marks each as it hits
// it, and the final report fails if any declared surface went uncovered (silent gap guard).
const SURFACES = [
  "mcp:get_context",
  "mcp:create_node",
  "mcp:park_ask",
  "mcp:transition",
  "mcp:error:NOT_FOUND",
  "mcp:error:STALE_VERSION",
  "node:DRAFT→ACTIVE",
  "node:ACTIVE→DONE",
  "node:ACTIVE→DISCARDED",
  "ask:DECISION",
  "ask:QUESTION",
  "ask:PROPOSAL",
  "rest:/healthz",
  "rest:/v1/projects",
  "rest:/inbox",
  "rest:/inbox:ranking",
  "rest:/progress",
  "rest:/events:tail",
  "rest:/answer:DECISION",
  "rest:/answer:QUESTION",
  "rest:/answer:PROPOSAL:adjust",
  "rest:error:404",
  "security:cross-project-isolation",
  "ws:connect",
  "ws:delta:snapshot",
  "ws:delta:upsert",
  "ws:delta:removal",
] as const;

class Walk {
  readonly covered = new Set<string>();
  private failures: string[] = [];

  cover(surface: (typeof SURFACES)[number]): void {
    this.covered.add(surface);
  }

  assert(cond: unknown, msg: string): asserts cond {
    if (!cond) {
      this.failures.push(msg);
      throw new WalkError(msg);
    }
  }

  finalize(): void {
    const missing = SURFACES.filter((s) => !this.covered.has(s));
    if (missing.length > 0) {
      this.failures.push(`uncovered surfaces: ${missing.join(", ")}`);
    }
    if (this.failures.length > 0) {
      throw new WalkError(`walk failed:\n  - ${this.failures.join("\n  - ")}`);
    }
  }
}

const text = (r: CallToolResult): Rec => JSON.parse((r.content[0] as { text: string }).text) as Rec;

// ─── minimal live-wire WebSocket client (Node 22 global WebSocket; no `ws` dependency) ───
interface WsFrame {
  type: string;
  seq?: number;
  upserts?: Array<{ askId: string }>;
  removedAskIds?: string[];
  reason?: string;
}

class LiveSocket {
  private readonly frames: WsFrame[] = [];
  private waiters: Array<() => void> = [];
  private readonly sock: WebSocket;
  private constructor(sock: WebSocket) {
    this.sock = sock;
  }

  static async open(wsBase: string, project: string): Promise<LiveSocket> {
    const sock = new WebSocket(`${wsBase}/v1/projects/${project}/stream`);
    const live = new LiveSocket(sock);
    sock.addEventListener("message", (ev: MessageEvent) => {
      live.frames.push(JSON.parse(String(ev.data)) as WsFrame);
      const wake = live.waiters;
      live.waiters = [];
      for (const w of wake) w();
    });
    await new Promise<void>((resolve, reject) => {
      sock.addEventListener("open", () => resolve(), { once: true });
      sock.addEventListener("error", () => reject(new WalkError("WS connect failed")), {
        once: true,
      });
    });
    return live;
  }

  resume(project: string, lastSeq: number | null): void {
    this.sock.send(JSON.stringify({ type: "resume", projectId: project, lastSeq }));
  }

  // Wait until a buffered frame matches, or time out. Scans frames already received too,
  // so a delta that arrived before we started waiting is not missed.
  async await(match: (f: WsFrame) => boolean, ms = 10_000): Promise<WsFrame> {
    const deadline = Date.now() + ms;
    for (;;) {
      const hit = this.frames.find(match);
      if (hit) return hit;
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new WalkError("timed out waiting for a matching WS frame");
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, remaining);
        this.waiters.push(() => {
          clearTimeout(t);
          resolve();
        });
      });
    }
  }

  close(): void {
    this.sock.close();
  }
}

// ─── the walk ────────────────────────────────────────────────────────────────────────
export async function runWalk(opts: WalkOptions = {}): Promise<WalkResult> {
  const mcpUrl = opts.mcpUrl ?? process.env.WAYPOINT_MCP_URL ?? "http://localhost:8848/mcp";
  const rest = opts.rest ?? process.env.WAYPOINT_REST ?? "http://localhost:8849";
  const wsBase = opts.ws ?? process.env.WAYPOINT_WS ?? "ws://localhost:8849";
  const project = opts.project ?? process.env.WAYPOINT_WALK_PROJECT ?? "default";
  const session = `walk-${Date.now()}`;
  const w = new Walk();
  const started = Date.now();

  const mcp = new Client({ name: "full-surface-walk", version: "0.0.0" });
  await mcp.connect(new StreamableHTTPClientTransport(new URL(mcpUrl)));

  // Tool callers: `call` throws on any error; `callRaw` returns the typed error body so we
  // can assert NOT_FOUND / STALE_VERSION explicitly.
  const callRaw = async (name: string, args: Rec): Promise<{ isError: boolean; body: Rec }> => {
    const res = (await mcp.callTool({ name, arguments: args })) as CallToolResult;
    return { isError: res.isError === true, body: text(res) };
  };
  const call = async (name: string, args: Rec): Promise<Rec> => {
    const { isError, body } = await callRaw(name, args);
    if (isError) throw new WalkError(`${name} errored: ${JSON.stringify(body)}`);
    return body;
  };
  const node = (parentId: string | null, kind: string, title: string) =>
    call("create_node", { projectId: project, parentId, kind, title, sessionId: session });
  const transition = (nodeId: string, to: string, expectedVersion: number, reason?: string) =>
    call("transition", {
      projectId: project,
      nodeId,
      to,
      expectedVersion,
      sessionId: session,
      ...(reason !== undefined ? { reason } : {}),
    });
  const getJson = async (path: string): Promise<{ status: number; body: Rec }> => {
    const res = await fetch(`${rest}${path}`);
    return { status: res.status, body: (await res.json()) as Rec };
  };

  const stamp = Date.now();
  let goal: Rec | undefined;
  let live: LiveSocket | undefined;

  try {
    // 1. get_context on the live project (seeded) — entry point, no error.
    await call("get_context", { projectId: project });
    w.cover("mcp:get_context");

    // 2-7. Build a small spine: goal → plan → 3 tasks, activating each.
    goal = await node(null, "goal", `walk goal (${stamp})`);
    w.cover("mcp:create_node");
    await transition(goal.id as string, "ACTIVE", 1);
    w.cover("mcp:transition");
    w.cover("node:DRAFT→ACTIVE");
    const plan = await node(goal.id as string, "plan", `walk plan (${stamp})`);
    await transition(plan.id as string, "ACTIVE", 1);
    const taskA = await node(plan.id as string, "task", `walk task A — decision (${stamp})`);
    const taskB = await node(plan.id as string, "task", `walk task B — question (${stamp})`);
    const taskC = await node(plan.id as string, "task", `walk task C — proposal (${stamp})`);
    await transition(taskA.id as string, "ACTIVE", 1);
    await transition(taskB.id as string, "ACTIVE", 1);
    await transition(taskC.id as string, "ACTIVE", 1);

    // 8. Open the live inbox stream and take the initial snapshot.
    live = await LiveSocket.open(wsBase, project);
    w.cover("ws:connect");
    live.resume(project, null);
    const snapshot = await live.await((f) => f.type === "delta");
    w.assert(typeof snapshot.seq === "number", "snapshot delta carries a numeric seq");
    w.cover("ws:delta:snapshot");

    // 9. Park a DECISION (≥2 options) and watch it arrive as a WS upsert.
    const decision = await call("park_ask", {
      projectId: project,
      nodeId: taskA.id,
      type: "DECISION",
      prompt: `walk: which store? (${stamp})`,
      required: true,
      risk: "high",
      reversible: false,
      rationale: `walk decision rationale (${stamp})`,
      options: [
        { label: `Postgres ${stamp}`, consequence: "durable" },
        { label: `SQLite ${stamp}`, consequence: "no concurrency" },
      ],
      agentLabel: "walk-agent",
      sessionId: session,
    });
    w.cover("mcp:park_ask");
    w.cover("ask:DECISION");
    await live.await(
      (f) => f.type === "delta" && (f.upserts ?? []).some((u) => u.askId === decision.id),
    );
    w.cover("ws:delta:upsert");

    // 10-11. Park a QUESTION (with suggestedAnswers) and a PROPOSAL.
    const question = await call("park_ask", {
      projectId: project,
      nodeId: taskB.id,
      type: "QUESTION",
      prompt: `walk: what is the deadline? (${stamp})`,
      required: true,
      suggestedAnswers: ["EOD", "tomorrow"],
      agentLabel: "walk-agent",
      sessionId: session,
    });
    w.cover("ask:QUESTION");
    const proposal = await call("park_ask", {
      projectId: project,
      nodeId: taskC.id,
      type: "PROPOSAL",
      prompt: `walk: adopt the new layout? (${stamp})`,
      required: true,
      agentLabel: "walk-agent",
      sessionId: session,
    });
    w.cover("ask:PROPOSAL");

    // 12. REST: cross-project home.
    const projects = await getJson("/v1/projects");
    w.assert(projects.status === 200, "/v1/projects → 200");
    w.assert(
      Array.isArray(projects.body.projects) &&
        (projects.body.projects as Rec[]).some((p) => p.id === project),
      "/v1/projects lists the walk project",
    );
    w.cover("rest:/v1/projects");

    // 13. REST: inbox — our three asks present; ranking invariant holds.
    const inbox = await getJson(`/v1/projects/${project}/inbox`);
    w.assert(inbox.status === 200, "/inbox → 200");
    const items = inbox.body.items as Array<Rec>;
    const findItem = (askId: string): Rec => {
      const it = items.find((i) => i.askId === askId);
      w.assert(it !== undefined, `inbox contains ask ${askId}`);
      return it as Rec;
    };
    const decisionItem = findItem(decision.id as string);
    findItem(question.id as string);
    findItem(proposal.id as string);
    w.cover("rest:/inbox");
    // Ranking: blastRadius desc, ties broken by parkedAt asc (oldest first).
    for (let i = 1; i < items.length; i++) {
      const a = items[i - 1] as { blastRadius: number; parkedAt: number };
      const b = items[i] as { blastRadius: number; parkedAt: number };
      w.assert(
        a.blastRadius > b.blastRadius ||
          (a.blastRadius === b.blastRadius && a.parkedAt <= b.parkedAt),
        "inbox is ranked by blastRadius desc, ties oldest-first",
      );
    }
    w.cover("rest:/inbox:ranking");

    // 14. REST: progress — the spine and a blocked task surface.
    const progress = await getJson(`/v1/projects/${project}/progress`);
    w.assert(progress.status === 200, "/progress → 200");
    w.assert(Array.isArray(progress.body.goals), "/progress carries goals[]");
    w.cover("rest:/progress");

    // 15. REST: events — append-only audit; tail semantics (length bounded, seq is latest).
    const events = await getJson(`/v1/projects/${project}/events?sinceSeq=0`);
    w.assert(events.status === 200, "/events → 200");
    const evs = events.body.events as Rec[];
    w.assert(Array.isArray(evs) && evs.length <= 500, "/events returns at most the tail 500");
    w.assert(
      evs.some((e) => e.verb === "ask.parked") && evs.some((e) => e.verb === "node.created"),
      "/events records node.created and ask.parked verbs",
    );
    w.assert(
      typeof events.body.seq === "number" && (events.body.seq as number) >= (evs.length || 0),
      "/events seq reflects the latest project seq, not the page length",
    );
    w.cover("rest:/events:tail");

    // 16. Answer the DECISION (server-assigned option id from the inbox) → ANSWERED, unblocked.
    const optionId = (decisionItem.options as Array<{ id: string }>)[0].id;
    const ansDecision = await fetch(`${rest}/v1/projects/${project}/asks/${decision.id}/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion: decisionItem.askVersion,
        chosenOptionId: optionId,
      }),
    });
    const ansDecisionBody = (await ansDecision.json()) as Rec;
    w.assert(ansDecision.status === 200, "answer DECISION → 200");
    w.assert(ansDecisionBody.askState === "ANSWERED", "DECISION becomes ANSWERED");
    w.assert(ansDecisionBody.nodeBlocked === false, "answering unblocks the node");
    w.cover("rest:/answer:DECISION");
    // The answered ask leaves the queue → WS removal.
    await live.await(
      (f) => f.type === "delta" && (f.removedAskIds ?? []).includes(decision.id as string),
    );
    w.cover("ws:delta:removal");

    // 17. Answer the QUESTION (free text).
    const qItem = findItem(question.id as string);
    const ansQuestion = await fetch(`${rest}/v1/projects/${project}/asks/${question.id}/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedVersion: qItem.askVersion, answerText: "tomorrow" }),
    });
    w.assert(ansQuestion.status === 200, "answer QUESTION → 200");
    w.cover("rest:/answer:QUESTION");

    // 18. Answer the PROPOSAL with an adjustment (approval carrying a constraint).
    const pItem = findItem(proposal.id as string);
    const ansProposal = await fetch(`${rest}/v1/projects/${project}/asks/${proposal.id}/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion: pItem.askVersion,
        proposalVerdict: "adjust",
        adjustmentNote: "ship behind a flag",
      }),
    });
    const ansProposalBody = (await ansProposal.json()) as Rec;
    w.assert(ansProposal.status === 200, "answer PROPOSAL → 200");
    w.assert(ansProposalBody.proposalVerdict === "adjust", "proposal verdict echoed");
    w.assert(ansProposalBody.adjustmentNote === "ship behind a flag", "adjustment note echoed");
    w.cover("rest:/answer:PROPOSAL:adjust");

    // 19. Optimistic concurrency: a stale expectedVersion is rejected with the actual version.
    const stale = await callRaw("transition", {
      projectId: project,
      nodeId: taskA.id,
      to: "DONE",
      expectedVersion: 1, // taskA is at version 2 (DRAFT→ACTIVE)
      sessionId: session,
    });
    w.assert(stale.isError && stale.body.code === "STALE_VERSION", "stale write → STALE_VERSION");
    w.assert(typeof stale.body.actualVersion === "number", "STALE_VERSION carries actualVersion");
    w.cover("mcp:error:STALE_VERSION");

    // 20-21. Finish the lifecycle: one task DONE, one DISCARDED (reason required).
    await transition(taskA.id as string, "DONE", stale.body.actualVersion as number);
    w.cover("node:ACTIVE→DONE");
    await transition(taskB.id as string, "DISCARDED", 2, "walk cleanup");
    w.cover("node:ACTIVE→DISCARDED");

    // 22. NOT_FOUND on an unknown node.
    const notFound = await callRaw("transition", {
      projectId: project,
      nodeId: `missing-${stamp}`,
      to: "DONE",
      expectedVersion: 1,
      sessionId: session,
    });
    w.assert(notFound.isError && notFound.body.code === "NOT_FOUND", "unknown node → NOT_FOUND");
    w.cover("mcp:error:NOT_FOUND");

    // 23. Cross-project isolation: taskC is real in `project`, but invisible under another
    //     project id — addressing it there must NOT_FOUND, never leak or mutate.
    const otherProject = `iso-probe-${stamp}`;
    const isolation = await callRaw("transition", {
      projectId: otherProject,
      nodeId: taskC.id,
      to: "DONE",
      expectedVersion: 2,
      sessionId: session,
    });
    w.assert(
      isolation.isError && isolation.body.code === "NOT_FOUND",
      "a node is invisible under a different project id (tenant isolation)",
    );
    w.cover("security:cross-project-isolation");

    // 24. REST 404 envelope on an unknown ask.
    const rest404 = await fetch(`${rest}/v1/projects/${project}/asks/missing-${stamp}/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedVersion: 1, answerText: "x" }),
    });
    const rest404Body = (await rest404.json()) as Rec;
    w.assert(rest404.status === 404, "unknown ask → 404");
    w.assert(typeof rest404Body.error === "string", "404 carries the error envelope");
    w.cover("rest:error:404");

    // 25. Liveness probe.
    const health = await getJson("/healthz");
    w.assert(health.status === 200 && health.body.status === "ok", "/healthz → {status:ok}");
    w.cover("rest:/healthz");

    w.finalize();
  } finally {
    // Best-effort cleanup so a shared dev project is not polluted (no-op on a throwaway DB).
    if (goal) {
      await transition(goal.id as string, "DISCARDED", 2, "walk cleanup").catch(() => {});
    }
    live?.close();
    await mcp.close();
  }

  return { covered: [...w.covered], durationMs: Date.now() - started };
}

// ─── standalone entry point ─────────────────────────────────────────────────────────────
const isMain =
  typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  runWalk()
    .then((r) => {
      console.log(
        `\n✅ full-surface walk passed — ${r.covered.length} surfaces in ${r.durationMs}ms`,
      );
      for (const s of r.covered.sort()) console.log(`   ✓ ${s}`);
      process.exit(0);
    })
    .catch((err: unknown) => {
      console.error(`\n❌ full-surface walk FAILED\n${err instanceof Error ? err.message : err}`);
      process.exit(1);
    });
}
