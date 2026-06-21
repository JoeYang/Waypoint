import type {
  Event,
  Node,
  Ask,
  DependencyEdge,
  StoryEntry,
  Digest,
  DigestNode,
  DigestAsk,
  DigestActiveWork,
  DigestHeadsUp,
  DigestTallies,
  NotificationPolicy,
  EscalationInput,
  EscalationDecision,
} from "@waypoint/shared";
import { stableAliasFromSession, countDependents } from "./projections.js";

// V2 slice 3 — re-entry projections + the escalation decision. All pure: they take already-loaded
// data (the core use-cases below issue the bounded reads inside one transaction) so the narrative,
// digest, and escalation rules are unit-tested without a DB and always agree with the spine/inbox.

// Upper bound on a single story/digest read — a returning human reorients on a recent window, not
// an unbounded backlog (database.md: always bound queries). A very long absence summarizes the
// most recent REENTRY_PAGE_MAX events.
export const REENTRY_PAGE_MAX = 500;

// Resolve the node an event threads under: a node-ref event is itself; an ask-ref event threads
// under the ask's node (falling back to the raw ref id if the ask is gone from the read model).
function threadNodeId(event: Event, askById: Map<string, Ask>): string {
  if (event.ref.kind === "node") return event.ref.id;
  return askById.get(event.ref.id)?.nodeId ?? event.ref.id;
}

// Project events (ascending by seq) into node-threaded narrative entries, oldest-first, bounded to
// the most recent page. The actor label is derived deterministically from the session id (never the
// raw id); a human / unattributed event reads as a null label.
export function projectStory(
  events: Event[],
  nodeById: Map<string, Node>,
  askById: Map<string, Ask>,
  limit: number,
): StoryEntry[] {
  return events.slice(-limit).map((e) => {
    const nodeId = threadNodeId(e, askById);
    return {
      seq: e.seq,
      at: e.at,
      actor: e.actor,
      actorLabel: e.sessionId !== null ? stableAliasFromSession(e.sessionId) : null,
      verb: e.verb,
      nodeId,
      nodeTitle: nodeById.get(nodeId)?.title ?? null,
      summary: e.summary,
    };
  });
}

// True iff the node currently has a required OPEN ask — the "blocked-on-ask" condition the spine
// uses for task state. Kept local so the digest agrees with deriveTaskState without importing it.
function hasRequiredOpenAsk(asks: Ask[], nodeId: string): boolean {
  return asks.some((a) => a.nodeId === nodeId && a.required && a.state === "OPEN");
}

// Project the while-you-were-away digest from the window of events since the cursor, rolled up
// across the three levels: what shipped (reached DONE), what is newly blocked (gained a required
// open ask and is still blocked), and what is waiting on the human now (the open-ask queue).
export function projectDigest(
  windowEvents: Event[], // events with seq > lastSeenSeq, ascending
  nodes: Node[],
  asks: Ask[],
  edges: DependencyEdge[],
  lastSeenSeq: number,
  now: number,
  limit: number,
): Omit<Digest, "projectId" | "seq"> {
  const window = windowEvents.slice(-limit);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const askById = new Map(asks.map((a) => [a.id, a]));

  // Asks parked within the unseen window — the "new since you left" set for waiting rows.
  const newAskIds = new Set<string>();
  for (const e of window) {
    if (e.verb === "ask.parked" && e.ref.kind === "ask") newAskIds.add(e.ref.id);
  }

  // shipped: nodes a transition event moved, that are now DONE. Dedup, keep first-seen order.
  const shipped: DigestNode[] = [];
  const shippedSeen = new Set<string>();
  for (const e of window) {
    if (e.verb !== "node.transitioned" || e.ref.kind !== "node") continue;
    const n = nodeById.get(e.ref.id);
    if (!n || n.status !== "DONE" || shippedSeen.has(n.id)) continue;
    shippedSeen.add(n.id);
    shipped.push({ nodeId: n.id, kind: n.kind, title: n.title });
  }

  // newlyBlocked: nodes that gained a parked ask in the window and are still blocked now.
  const newlyBlocked: DigestNode[] = [];
  const blockedSeen = new Set<string>();
  for (const e of window) {
    if (e.verb !== "ask.parked" || e.ref.kind !== "ask") continue;
    const ask = askById.get(e.ref.id);
    const n = ask ? nodeById.get(ask.nodeId) : undefined;
    if (!n || blockedSeen.has(n.id) || !hasRequiredOpenAsk(asks, n.id)) continue;
    blockedSeen.add(n.id);
    newlyBlocked.push({ nodeId: n.id, kind: n.kind, title: n.title });
  }

  // waiting: the current open-ask queue (a snapshot of what needs the human now), ranked like the
  // inbox — most-blocking first, ties broken by longest wait.
  const waiting: DigestAsk[] = asks
    .filter((a) => a.state === "OPEN")
    .map((a) => {
      const n = nodeById.get(a.nodeId);
      return {
        askId: a.id,
        nodeId: a.nodeId,
        nodeTitle: n?.title ?? a.nodeId,
        type: a.type,
        prompt: a.prompt,
        blastRadius: countDependents(edges, a.nodeId),
        ageMs: Math.max(0, now - a.createdAt),
        risk: a.risk,
        reversible: a.reversible,
        isNew: newAskIds.has(a.id),
      };
    })
    .sort((x, y) => y.blastRadius - x.blastRadius || y.ageMs - x.ageMs);

  // activeWork: where agents are now — task nodes that are ACTIVE and not blocked on a required
  // open ask (a snapshot, not window-bound), most-recently-touched first. Names the task + its
  // parent stream; never a file path (no agent file-cursor exists). Stable tiebreak on id.
  const activeWork: DigestActiveWork[] = nodes
    .filter((n) => n.kind === "task" && n.status === "ACTIVE" && !hasRequiredOpenAsk(asks, n.id))
    .sort((a, b) => b.updatedAt - a.updatedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((n) => {
      const parent = n.parentId !== null ? nodeById.get(n.parentId) : undefined;
      return {
        nodeId: n.id,
        nodeTitle: n.title,
        kind: n.kind,
        streamId: n.parentId,
        streamTitle: parent?.title ?? null,
      };
    });

  // headsUp: open asks that need a careful eye — irreversible or high-risk. Irreversible reads as
  // danger, a reversible-but-high-risk ask as warning. Danger first, then oldest-waiting first.
  const headsUp: DigestHeadsUp[] = asks
    .filter((a) => a.state === "OPEN" && (!a.reversible || a.risk === "high"))
    .map((a) => {
      const n = nodeById.get(a.nodeId);
      const kind = !a.reversible ? "danger" : "warning";
      return {
        askId: a.id,
        nodeId: a.nodeId,
        nodeTitle: n?.title ?? a.nodeId,
        prompt: a.prompt,
        risk: a.risk,
        reversible: a.reversible,
        kind,
      } satisfies DigestHeadsUp;
    })
    .sort(
      (x, y) =>
        (x.kind === "danger" ? 0 : 1) - (y.kind === "danger" ? 0 : 1) ||
        (x.askId < y.askId ? -1 : x.askId > y.askId ? 1 : 0),
    );

  // tallies: task-kind nodes by derived state for the progress meter. A parked task (required open
  // ask) counts as parked regardless of stored status; DISCARDED is excluded entirely.
  const tallies: DigestTallies = { done: 0, active: 0, parked: 0, queued: 0 };
  for (const n of nodes) {
    if (n.kind !== "task" || n.status === "DISCARDED") continue;
    if (hasRequiredOpenAsk(asks, n.id)) tallies.parked += 1;
    else if (n.status === "DONE") tallies.done += 1;
    else if (n.status === "ACTIVE") tallies.active += 1;
    else if (n.status === "DRAFT") tallies.queued += 1;
  }

  return { sinceSeq: lastSeenSeq, shipped, newlyBlocked, waiting, activeWork, headsUp, tallies };
}

// The tiered-escalation decision: push a single notification only when blast radius crosses the
// user-set threshold or the ask has aged past the SLA; otherwise batch it into the next digest.
// Pure — the use-case below gathers the inputs (blast radius recomputed at notify-time). Threshold
// is checked before age so a high-impact ask reports the more actionable reason.
export function decideEscalation(
  input: EscalationInput,
  policy: NotificationPolicy,
): EscalationDecision {
  if (input.blastRadius >= policy.blastRadiusThreshold) return { push: true, reason: "threshold" };
  if (input.ageSeconds >= policy.ageSlaSeconds) return { push: true, reason: "sla" };
  return { push: false, reason: "none" };
}
