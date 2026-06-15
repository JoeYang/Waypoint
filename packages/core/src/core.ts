import type {
  Node,
  NodeKind,
  NodeStatus,
  Ask,
  AskOption,
  AskState,
  ContextPack,
  CreateNodeInput,
  DependencyEdge,
  InboxItem,
  InboxResponse,
  TransitionInput,
  ParkAskInput,
  ProposalVerdict,
} from "@waypoint/shared";
import type { Clock, IdGenerator, UnitOfWork, RepositoryContext } from "./ports.js";
import { NotFoundError, ValidationError, StaleVersionError } from "./errors.js";

// The status spine. Every legal move is listed; anything else is rejected. DONE and
// DISCARDED are terminal in this slice.
const SPINE: Record<NodeStatus, readonly NodeStatus[]> = {
  DRAFT: ["ACTIVE", "DISCARDED"],
  ACTIVE: ["DONE", "DISCARDED"],
  DONE: [],
  DISCARDED: [],
};

export interface CoreDeps {
  uow: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
}

// depends_on edges are not an MCP tool in this slice; they are created by seeding and
// the (future) dependency tool. Core supports them because blast-radius ranking needs them.
export interface AddDependencyInput {
  projectId: string;
  nodeId: string;
  dependsOnId: string;
  sessionId?: string;
}

// Proceed-on-assumption + resolution are core use-cases (no MCP tool in this slice).
export interface AssumeInput {
  projectId: string;
  askId: string;
  assumption: string;
  expectedVersion: number;
  sessionId?: string;
}

export interface ResolveAssumptionInput {
  projectId: string;
  askId: string;
  expectedVersion: number;
  sessionId?: string;
}

export interface AnswerInput {
  projectId: string;
  askId: string;
  expectedVersion: number;
  chosenOptionId?: string; // DECISION
  answerText?: string; // QUESTION
  proposalVerdict?: ProposalVerdict; // PROPOSAL: approve | adjust | reject
  adjustmentNote?: string; // only meaningful (and required) with an `adjust` verdict
  sessionId?: string;
}

// A stable, human-friendly alias derived deterministically from a session id, so the same
// session always reads as the same "who" in the story without ever exposing the raw id.
// Pure (no clock/random) — same input always yields the same label.
const ALIAS_ADJECTIVES = [
  "swift",
  "calm",
  "bright",
  "bold",
  "keen",
  "wise",
  "brave",
  "quiet",
  "sharp",
  "deft",
] as const;
const ALIAS_NOUNS = [
  "otter",
  "falcon",
  "maple",
  "harbor",
  "cedar",
  "comet",
  "river",
  "lark",
  "ember",
  "fox",
] as const;
function stableAliasFromSession(sessionId: string): string {
  // FNV-1a 32-bit hash → deterministic index into the friendly name pools.
  let h = 0x811c9dc5;
  for (let i = 0; i < sessionId.length; i++) {
    h ^= sessionId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const u = h >>> 0;
  const adj = ALIAS_ADJECTIVES[u % ALIAS_ADJECTIVES.length] ?? "agent";
  const noun =
    ALIAS_NOUNS[Math.floor(u / ALIAS_ADJECTIVES.length) % ALIAS_NOUNS.length] ?? "session";
  return `${adj}-${noun}`;
}

// Human-readable resolution of a resolved ask for the context pack (never raw payloads).
function resolutionText(ask: Ask): string {
  if (ask.chosenOptionId !== null) {
    return ask.options.find((o) => o.id === ask.chosenOptionId)?.label ?? ask.chosenOptionId;
  }
  return ask.answerText ?? ask.state;
}

const RESOLVED_STATES = new Set(["ANSWERED", "CONFIRMED", "OVERTURNED"]);

// Asks still awaiting a human decision — the inbox's membership. OPEN asks block; ASSUMED
// asks let the agent proceed but the human may still confirm or overturn them.
const PENDING_STATES = new Set<AskState>(["OPEN", "ASSUMED"]);

// Loads an ask and enforces the optimistic-concurrency guard before any state change.
async function requireAsk(
  ctx: RepositoryContext,
  projectId: string,
  askId: string,
  expectedVersion: number,
): Promise<Ask> {
  const ask = await ctx.asks.findById(projectId, askId);
  if (!ask) throw new NotFoundError("ask", askId);
  if (ask.version !== expectedVersion) {
    throw new StaleVersionError("ask", askId, expectedVersion, ask.version);
  }
  return ask;
}

// The domain use-cases the adapters (MCP, REST) drive. Every mutation runs inside a
// single UnitOfWork transaction so the row change and its event append commit together.
export interface Core {
  createNode(input: CreateNodeInput): Promise<Node>;
  addDependency(input: AddDependencyInput): Promise<void>;
  transition(input: TransitionInput): Promise<Node>;
  parkAsk(input: ParkAskInput): Promise<Ask>;
  assume(input: AssumeInput): Promise<Ask>;
  confirmAssumption(input: ResolveAssumptionInput): Promise<Ask>;
  overturnAssumption(input: ResolveAssumptionInput): Promise<Ask>;
  answer(input: AnswerInput): Promise<Ask>;
  // Reads — computed on demand, never stored (a future cache MUST equal these values).
  getNode(projectId: string, nodeId: string): Promise<Node>;
  computeBlocked(projectId: string, nodeId: string): Promise<boolean>;
  blastRadius(projectId: string, nodeId: string): Promise<number>;
  listInbox(projectId: string): Promise<InboxResponse>;
  getContext(projectId: string): Promise<ContextPack>;
}

// True if `target` is reachable from `from` by following depends_on edges. Used to
// reject edges that would close a cycle (adding from→target while target⇒…⇒from exists).
function dependsOnReaches(edges: DependencyEdge[], from: string, target: string): boolean {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const next = adjacency.get(edge.nodeId) ?? [];
    next.push(edge.dependsOnId);
    adjacency.set(edge.nodeId, next);
  }
  const seen = new Set<string>();
  const stack = [from];
  for (let cur = stack.pop(); cur !== undefined; cur = stack.pop()) {
    if (cur === target) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const next of adjacency.get(cur) ?? []) stack.push(next);
  }
  return false;
}

// Count of nodes that directly depend on `nodeId` — its blast radius (direct edges only).
function countDependents(edges: DependencyEdge[], nodeId: string): number {
  return edges.filter((e) => e.dependsOnId === nodeId).length;
}

// The named nodes that directly depend on `nodeId`, resolved to { nodeId, title }.
function namedDependents(
  edges: DependencyEdge[],
  nodeById: Map<string, Node>,
  nodeId: string,
): { nodeId: string; title: string }[] {
  return edges
    .filter((e) => e.dependsOnId === nodeId)
    .flatMap((e) => {
      const dependent = nodeById.get(e.nodeId);
      return dependent ? [{ nodeId: dependent.id, title: dependent.title }] : [];
    });
}

// First ancestor of `kind` walking parent_id upward from `startId` (inclusive), cycle-guarded
// so a corrupt hierarchy terminates. Returns null if no such ancestor exists.
function ancestorOfKind(nodeById: Map<string, Node>, startId: string, kind: NodeKind): Node | null {
  const seen = new Set<string>();
  let cur = nodeById.get(startId);
  while (cur !== undefined && !seen.has(cur.id)) {
    seen.add(cur.id);
    if (cur.kind === kind) return cur;
    cur = cur.parentId !== null ? nodeById.get(cur.parentId) : undefined;
  }
  return null;
}

// Projects a pending ask + its owning node into the enriched InboxItem the human answers
// from — shared by the inbox list and the project spine (so a card reads identically in both).
function buildInboxItem(
  ask: Ask,
  node: Node,
  nodeById: Map<string, Node>,
  edges: DependencyEdge[],
): InboxItem {
  return {
    askId: ask.id,
    nodeId: ask.nodeId,
    nodeTitle: node.title,
    type: ask.type,
    state: ask.state,
    prompt: ask.prompt,
    required: ask.required,
    options: ask.options,
    blastRadius: countDependents(edges, ask.nodeId),
    parkedAt: ask.createdAt,
    askVersion: ask.version,
    nodeVersion: node.version,
    // Decision context (slice 1) — enrich so the human can answer without re-deriving.
    rationale: ask.rationale,
    blocks: namedDependents(edges, nodeById, ask.nodeId),
    goalTitle: ancestorOfKind(nodeById, ask.nodeId, "goal")?.title ?? null,
    suggestedAnswers: ask.suggestedAnswers,
    ...(ask.agentLabel !== null
      ? { parkedBy: { agentLabel: ask.agentLabel, at: ask.createdAt } }
      : {}),
  };
}

export function createCore(deps: CoreDeps): Core {
  const { uow, clock, ids } = deps;

  return {
    async createNode(input) {
      return uow.run(async (ctx) => {
        const project = await ctx.projects.findById(input.projectId);
        if (!project) throw new NotFoundError("project", input.projectId);

        // A parent must exist within the same project. A parent in another project is
        // simply not visible here (repos are project-scoped), so cross-project parents
        // are rejected as validation errors without ever querying across the boundary.
        if (input.parentId !== null) {
          const parent = await ctx.nodes.findById(input.projectId, input.parentId);
          if (!parent) {
            throw new ValidationError("parent not found in project", {
              projectId: input.projectId,
              parentId: input.parentId,
            });
          }
        }

        const now = clock.now();
        const node: Node = {
          id: ids.generate(),
          projectId: input.projectId,
          parentId: input.parentId,
          kind: input.kind,
          title: input.title,
          status: "DRAFT",
          discardReason: null,
          sessionId: input.sessionId ?? null,
          version: 1,
          createdAt: now,
          updatedAt: now,
        };
        await ctx.nodes.insert(node);
        await ctx.events.append({
          id: ids.generate(),
          projectId: node.projectId,
          actor: "agent",
          verb: "node.created",
          ref: { kind: "node", id: node.id },
          sessionId: node.sessionId,
          summary: `created ${node.kind}: ${node.title}`,
          at: now,
        });
        return node;
      });
    },

    async addDependency(input) {
      return uow.run(async (ctx) => {
        const dependent = await ctx.nodes.findById(input.projectId, input.nodeId);
        if (!dependent) {
          throw new ValidationError("dependent node not found in project", {
            projectId: input.projectId,
            nodeId: input.nodeId,
          });
        }
        const target = await ctx.nodes.findById(input.projectId, input.dependsOnId);
        if (!target) {
          throw new ValidationError("dependency target not found in project", {
            projectId: input.projectId,
            dependsOnId: input.dependsOnId,
          });
        }
        if (input.nodeId === input.dependsOnId) {
          throw new ValidationError("a node cannot depend on itself", { nodeId: input.nodeId });
        }

        const edges = await ctx.nodes.listDependencies(input.projectId);
        // Adding nodeId → dependsOnId closes a cycle iff dependsOnId already reaches nodeId.
        if (dependsOnReaches(edges, input.dependsOnId, input.nodeId)) {
          throw new ValidationError("dependency would create a cycle", {
            nodeId: input.nodeId,
            dependsOnId: input.dependsOnId,
          });
        }

        const edge: DependencyEdge = {
          projectId: input.projectId,
          nodeId: input.nodeId,
          dependsOnId: input.dependsOnId,
        };
        await ctx.nodes.addDependency(edge);
        await ctx.events.append({
          id: ids.generate(),
          projectId: input.projectId,
          actor: "agent",
          verb: "dependency.added",
          ref: { kind: "node", id: input.nodeId },
          sessionId: input.sessionId ?? null,
          summary: `depends_on ${input.dependsOnId}`,
          at: clock.now(),
        });
      });
    },

    async transition(input) {
      return uow.run(async (ctx) => {
        const node = await ctx.nodes.findById(input.projectId, input.nodeId);
        if (!node) throw new NotFoundError("node", input.nodeId);

        // Concurrency guard before any rule check: a stale caller is rejected outright
        // and learns the current version, then re-reads (overturn-while-done safety).
        if (node.version !== input.expectedVersion) {
          throw new StaleVersionError("node", node.id, input.expectedVersion, node.version);
        }
        if (!SPINE[node.status].includes(input.to)) {
          throw new ValidationError(`illegal transition ${node.status} → ${input.to}`, {
            from: node.status,
            to: input.to,
          });
        }
        if (input.to === "DISCARDED" && input.reason === undefined) {
          throw new ValidationError("discarding a node requires a reason", { nodeId: node.id });
        }

        const now = clock.now();
        const updated: Node = {
          ...node,
          status: input.to,
          discardReason: input.to === "DISCARDED" ? (input.reason ?? null) : node.discardReason,
          sessionId: input.sessionId ?? node.sessionId,
          version: node.version + 1,
          updatedAt: now,
        };
        await ctx.nodes.update(updated);
        await ctx.events.append({
          id: ids.generate(),
          projectId: node.projectId,
          actor: "agent",
          verb: "node.transitioned",
          ref: { kind: "node", id: node.id },
          sessionId: updated.sessionId,
          summary: `${node.status} → ${input.to}`,
          at: now,
        });
        return updated;
      });
    },

    async parkAsk(input) {
      return uow.run(async (ctx) => {
        const node = await ctx.nodes.findById(input.projectId, input.nodeId);
        if (!node) throw new NotFoundError("node", input.nodeId);
        // Re-checked here even though the boundary schema enforces it: core must hold
        // its own invariants for non-MCP callers (seeding, future transports).
        if (input.type === "DECISION" && input.options.length < 2) {
          throw new ValidationError("a DECISION ask requires at least two options", {
            nodeId: input.nodeId,
          });
        }

        const now = clock.now();
        // Normalize the backward-compatible option union (bare label or { label, consequence? }),
        // carrying the consequence through. A bare-string option gets no `consequence` key at all
        // (exactOptionalPropertyTypes), so it round-trips identically to the pre-slice-1 shape.
        const options: AskOption[] = input.options.map((o, i) => {
          const id = `opt-${i + 1}`;
          if (typeof o === "string") return { id, label: o };
          return o.consequence !== undefined
            ? { id, label: o.label, consequence: o.consequence }
            : { id, label: o.label };
        });
        // Provenance: an explicit label wins; otherwise derive a stable alias from the session
        // so the story reads naturally without leaking the raw session id. Null if neither given.
        const agentLabel =
          input.agentLabel ??
          (input.sessionId !== undefined ? stableAliasFromSession(input.sessionId) : null);
        const ask: Ask = {
          id: ids.generate(),
          projectId: input.projectId,
          nodeId: input.nodeId,
          type: input.type,
          state: "OPEN", // proceed-on-assumption is a separate OPEN → ASSUMED step
          required: input.required,
          prompt: input.prompt,
          rationale: input.rationale ?? null,
          options,
          suggestedAnswers: input.suggestedAnswers ?? [],
          agentLabel,
          chosenOptionId: null,
          assumption: null,
          answerText: null,
          version: 1,
          createdAt: now,
          updatedAt: now,
        };
        await ctx.asks.insert(ask);
        await ctx.events.append({
          id: ids.generate(),
          projectId: input.projectId,
          actor: "agent",
          verb: "ask.parked",
          ref: { kind: "ask", id: ask.id },
          sessionId: input.sessionId ?? null,
          summary: `parked ${input.type}: ${input.prompt}`,
          at: now,
        });
        return ask;
      });
    },

    async assume(input) {
      return uow.run(async (ctx) => {
        const ask = await requireAsk(ctx, input.projectId, input.askId, input.expectedVersion);
        if (ask.state !== "OPEN") {
          throw new ValidationError(`cannot assume a ${ask.state} ask`, { askId: ask.id });
        }
        const now = clock.now();
        const updated: Ask = {
          ...ask,
          state: "ASSUMED",
          assumption: input.assumption,
          version: ask.version + 1,
          updatedAt: now,
        };
        await ctx.asks.update(updated);
        await ctx.events.append({
          id: ids.generate(),
          projectId: ask.projectId,
          actor: "agent",
          verb: "ask.assumed",
          ref: { kind: "ask", id: ask.id },
          sessionId: input.sessionId ?? null,
          summary: `assumed: ${input.assumption}`,
          at: now,
        });
        return updated;
      });
    },

    async confirmAssumption(input) {
      return uow.run(async (ctx) => {
        const ask = await requireAsk(ctx, input.projectId, input.askId, input.expectedVersion);
        if (ask.state !== "ASSUMED") {
          throw new ValidationError(`cannot confirm a ${ask.state} ask`, { askId: ask.id });
        }
        const now = clock.now();
        const updated: Ask = {
          ...ask,
          state: "CONFIRMED",
          version: ask.version + 1,
          updatedAt: now,
        };
        await ctx.asks.update(updated);
        await ctx.events.append({
          id: ids.generate(),
          projectId: ask.projectId,
          actor: "human",
          verb: "ask.confirmed",
          ref: { kind: "ask", id: ask.id },
          sessionId: input.sessionId ?? null,
          summary: "assumption confirmed",
          at: now,
        });
        return updated;
      });
    },

    async overturnAssumption(input) {
      return uow.run(async (ctx) => {
        const ask = await requireAsk(ctx, input.projectId, input.askId, input.expectedVersion);
        if (ask.state !== "ASSUMED") {
          throw new ValidationError(`cannot overturn a ${ask.state} ask`, { askId: ask.id });
        }
        const now = clock.now();
        const updated: Ask = {
          ...ask,
          state: "OVERTURNED",
          version: ask.version + 1,
          updatedAt: now,
        };
        await ctx.asks.update(updated);

        // Bump the owning node so any in-flight node mutation premised on the assumption
        // (e.g. a concurrent transition → DONE) is rejected as stale and must re-triage.
        const node = await ctx.nodes.findById(ask.projectId, ask.nodeId);
        if (node) {
          await ctx.nodes.update({ ...node, version: node.version + 1, updatedAt: now });
        }
        await ctx.events.append({
          id: ids.generate(),
          projectId: ask.projectId,
          actor: "human",
          verb: "ask.overturned",
          ref: { kind: "ask", id: ask.id },
          sessionId: input.sessionId ?? null,
          summary: `assumption overturned — node ${ask.nodeId} needs re-triage`,
          at: now,
        });
        return updated;
      });
    },

    async answer(input) {
      return uow.run(async (ctx) => {
        const ask = await requireAsk(ctx, input.projectId, input.askId, input.expectedVersion);
        if (ask.state !== "OPEN") {
          throw new ValidationError(`cannot answer a ${ask.state} ask`, { askId: ask.id });
        }

        let chosenOptionId: string | null = null;
        let answerText: string | null = null;
        let summary = "answered";
        switch (ask.type) {
          case "DECISION": {
            if (input.chosenOptionId === undefined) {
              throw new ValidationError("a decision answer must choose an option", {
                askId: ask.id,
              });
            }
            if (!ask.options.some((o) => o.id === input.chosenOptionId)) {
              throw new ValidationError("chosen option is not on this ask", {
                askId: ask.id,
                chosenOptionId: input.chosenOptionId,
              });
            }
            chosenOptionId = input.chosenOptionId;
            summary = `answered: ${chosenOptionId}`;
            break;
          }
          case "PROPOSAL": {
            // A proposal is resolved by a verdict. `adjust` is an approval that carries a
            // constraint — the agent proceeds under it, not a fresh round-trip (the note is
            // the immutable record). approve/reject carry no note.
            if (input.proposalVerdict === undefined) {
              throw new ValidationError("a proposal answer must carry a verdict", {
                askId: ask.id,
              });
            }
            if (input.proposalVerdict === "adjust") {
              if (input.adjustmentNote === undefined) {
                throw new ValidationError("an adjusted proposal must carry a constraint note", {
                  askId: ask.id,
                });
              }
              answerText = input.adjustmentNote;
              summary = `approved with constraint: ${input.adjustmentNote}`;
            } else {
              if (input.adjustmentNote !== undefined) {
                throw new ValidationError(
                  "a constraint note is only valid with an adjust verdict",
                  {
                    askId: ask.id,
                    verdict: input.proposalVerdict,
                  },
                );
              }
              summary = input.proposalVerdict === "approve" ? "approved" : "rejected";
            }
            break;
          }
          case "QUESTION": {
            if (input.answerText === undefined) {
              throw new ValidationError("an answer must include text", { askId: ask.id });
            }
            answerText = input.answerText;
            break;
          }
          default: {
            const _exhaustive: never = ask.type;
            throw new ValidationError("unknown ask type", { askId: ask.id, type: _exhaustive });
          }
        }

        const now = clock.now();
        const updated: Ask = {
          ...ask,
          state: "ANSWERED",
          chosenOptionId,
          answerText,
          version: ask.version + 1,
          updatedAt: now,
        };
        await ctx.asks.update(updated);
        await ctx.events.append({
          id: ids.generate(),
          projectId: ask.projectId,
          actor: "human",
          verb: "ask.answered",
          ref: { kind: "ask", id: ask.id },
          sessionId: input.sessionId ?? null,
          summary,
          at: now,
        });
        return updated;
      });
    },

    async getNode(projectId, nodeId) {
      return uow.run(async (ctx) => {
        const node = await ctx.nodes.findById(projectId, nodeId);
        if (!node) throw new NotFoundError("node", nodeId);
        return node;
      });
    },

    async computeBlocked(projectId, nodeId) {
      return uow.run(async (ctx) => {
        const node = await ctx.nodes.findById(projectId, nodeId);
        if (!node) throw new NotFoundError("node", nodeId);

        // Blocked if there is an OPEN required ask (ASSUMED no longer blocks — the agent
        // proceeded) …
        const asks = await ctx.asks.listByProject(projectId);
        const hasOpenRequired = asks.some(
          (a) => a.nodeId === nodeId && a.required && a.state === "OPEN",
        );
        if (hasOpenRequired) return true;

        // … or any dependency that is not yet DONE.
        const edges = await ctx.nodes.listDependencies(projectId);
        const dependencies = edges.filter((e) => e.nodeId === nodeId);
        if (dependencies.length === 0) return false;
        const statusById = new Map(
          (await ctx.nodes.listByProject(projectId)).map((n) => [n.id, n.status]),
        );
        return dependencies.some((e) => statusById.get(e.dependsOnId) !== "DONE");
      });
    },

    async blastRadius(projectId, nodeId) {
      return uow.run(async (ctx) => {
        const edges = await ctx.nodes.listDependencies(projectId);
        return edges.filter((e) => e.dependsOnId === nodeId).length;
      });
    },

    async listInbox(projectId) {
      return uow.run(async (ctx) => {
        const project = await ctx.projects.findById(projectId);
        if (!project) throw new NotFoundError("project", projectId);

        // One transaction, sequential reads (a single pg client can't run concurrent
        // queries — see getContext). Blast radius is computed inline from the edge list,
        // not via core.blastRadius per ask, to avoid an N+1 on this hot read path.
        const asks = await ctx.asks.listByProject(projectId);
        const nodes = await ctx.nodes.listByProject(projectId);
        const edges = await ctx.nodes.listDependencies(projectId);
        const events = await ctx.events.listSince(projectId, 0);

        const nodeById = new Map(nodes.map((n) => [n.id, n]));
        const seq = events.length > 0 ? events[events.length - 1]!.seq : 0;

        const items: InboxItem[] = asks
          .filter((a) => PENDING_STATES.has(a.state))
          .flatMap((a) => {
            const node = nodeById.get(a.nodeId);
            if (!node) return []; // an ask without its node is not surfacable; skip defensively
            return [buildInboxItem(a, node, nodeById, edges)];
          })
          // Rank: most-blocking first; ties broken by who has waited longest.
          .sort((x, y) => y.blastRadius - x.blastRadius || x.parkedAt - y.parkedAt);

        return { projectId, seq, items };
      });
    },

    async getContext(projectId) {
      return uow.run(async (ctx) => {
        const project = await ctx.projects.findById(projectId);
        if (!project) throw new NotFoundError("project", projectId);

        // Sequential, not Promise.all: these share one transaction connection and a single
        // pg client cannot run concurrent queries (dogfooding surfaced this on real Postgres).
        const nodes = await ctx.nodes.listByProject(projectId);
        const asks = await ctx.asks.listByProject(projectId);
        const edges = await ctx.nodes.listDependencies(projectId);
        const events = await ctx.events.listSince(projectId, 0);

        const goal = nodes.find((n) => n.kind === "goal" && n.parentId === null)?.title ?? null;
        const dependents = (nodeId: string) => edges.filter((e) => e.dependsOnId === nodeId).length;

        const openAsks = asks
          .filter((a) => a.state === "OPEN")
          .map((a) => ({
            id: a.id,
            nodeId: a.nodeId,
            type: a.type,
            prompt: a.prompt,
            required: a.required,
            blastRadius: dependents(a.nodeId),
          }));

        const recentDecisions = asks
          .filter((a) => RESOLVED_STATES.has(a.state))
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, 5)
          .map((a) => ({
            askId: a.id,
            prompt: a.prompt,
            resolution: resolutionText(a),
            at: a.updatedAt,
          }));

        // Most recent activity that carried a session id.
        const lastSessionId =
          [...events].reverse().find((e) => e.sessionId !== null)?.sessionId ?? null;

        return {
          project: { id: project.id, name: project.name },
          goal,
          openAsks,
          recentDecisions,
          provenance: { lastSessionId },
        };
      });
    },
  };
}
