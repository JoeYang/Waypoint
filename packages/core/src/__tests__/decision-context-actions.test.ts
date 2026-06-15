import { describe, it, expect, beforeEach } from "vitest";
import { createCore, type Core } from "../core.js";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "../testing/in-memory.js";
import { ValidationError } from "../errors.js";

const PROJECT = "proj-1";

// V2 slice 1 (decision-context-and-actions), task 3 — the read model and answer actions.
// The inbox enriches each item with named blocked work, the ancestor goal, and provenance;
// an adjusted proposal is an approval carrying its constraint (one immutable event).

describe("listInbox — decision-context enrichment (task 3.2)", () => {
  let backend: InMemoryBackend;
  let core: Core;

  const node = (title: string, kind: "goal" | "plan" | "task", parentId: string | null) =>
    core.createNode({ projectId: PROJECT, parentId, kind, title });

  beforeEach(() => {
    backend = new InMemoryBackend();
    core = createCore({
      uow: backend.uow,
      clock: new FakeClock(1_000),
      ids: new FakeIdGenerator("x"),
    });
    backend.seedProject({ id: PROJECT, name: "Waypoint", createdAt: 0 });
  });

  it("enriches an item with named blocked work, the ancestor goal, and rationale", async () => {
    const goal = await node("Ship checkout", "goal", null);
    const cache = await node("cache layer", "task", goal.id);
    const refunds = await node("refunds", "task", goal.id);
    // refunds depends on cache → answering the ask on cache unblocks refunds.
    await core.addDependency({ projectId: PROJECT, nodeId: refunds.id, dependsOnId: cache.id });

    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId: cache.id,
      type: "DECISION",
      prompt: "which cache?",
      required: true,
      rationale: "blocks the refund path",
      options: ["redis", "memcached"],
    });

    const res = await core.listInbox(PROJECT);
    const item = res.items.find((i) => i.askId === ask.id);
    expect(item).toBeDefined();
    expect(item!.blocks).toEqual([{ nodeId: refunds.id, title: "refunds" }]);
    expect(item!.goalTitle).toBe("Ship checkout");
    expect(item!.rationale).toBe("blocks the refund path");
    expect(item!.blastRadius).toBe(1);
  });

  it("surfaces provenance (parkedBy) when the ask carries an agent label", async () => {
    const t = await node("solo", "task", null);
    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId: t.id,
      type: "QUESTION",
      prompt: "q?",
      required: false,
      options: [],
      agentLabel: "checkout-agent",
    });
    const res = await core.listInbox(PROJECT);
    const item = res.items.find((i) => i.askId === ask.id)!;
    expect(item.parkedBy).toEqual({ agentLabel: "checkout-agent", at: ask.createdAt });
  });

  it("reports a null goalTitle and terminates on a corrupt parent cycle (failure injection)", async () => {
    const a = await node("a", "task", null);
    const b = await node("b", "task", a.id);
    // Corrupt the hierarchy into an a → b → a cycle with no goal ancestor; the walk must
    // be cycle-guarded and still return.
    const stored = backend.state.nodes.get(a.id)!;
    stored.parentId = b.id;

    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId: a.id,
      type: "QUESTION",
      prompt: "q?",
      required: false,
      options: [],
    });
    const res = await core.listInbox(PROJECT);
    const item = res.items.find((i) => i.askId === ask.id)!;
    expect(item.goalTitle).toBeNull();
  });
});

describe("answer — proposal verdicts (task 3.3)", () => {
  let backend: InMemoryBackend;
  let core: Core;
  let nodeId: string;

  beforeEach(async () => {
    backend = new InMemoryBackend();
    core = createCore({
      uow: backend.uow,
      clock: new FakeClock(1_000),
      ids: new FakeIdGenerator("x"),
    });
    backend.seedProject({ id: PROJECT, name: "Waypoint", createdAt: 0 });
    const node = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "T",
    });
    nodeId = node.id;
  });

  const parkProposal = () =>
    core.parkAsk({
      projectId: PROJECT,
      nodeId,
      type: "PROPOSAL",
      prompt: "Replace the poller with a webhook?",
      required: true,
      options: [],
    });

  it("records an adjusted proposal as one immutable approval event carrying the constraint", async () => {
    const ask = await parkProposal();
    const answered = await core.answer({
      projectId: PROJECT,
      askId: ask.id,
      expectedVersion: 1,
      proposalVerdict: "adjust",
      adjustmentNote: "keep the poller for 30d",
    });

    expect(answered.state).toBe("ANSWERED");
    expect(answered.answerText).toBe("keep the poller for 30d");
    const events = await backend.events.listSince(PROJECT, 0);
    const answerEvents = events.filter((e) => e.verb === "ask.answered");
    expect(answerEvents).toHaveLength(1);
    expect(answerEvents[0]!.actor).toBe("human");
    expect(answerEvents[0]!.summary).toContain("keep the poller for 30d");
  });

  it("approves a proposal", async () => {
    const ask = await parkProposal();
    const answered = await core.answer({
      projectId: PROJECT,
      askId: ask.id,
      expectedVersion: 1,
      proposalVerdict: "approve",
    });
    expect(answered.state).toBe("ANSWERED");
  });

  it("rejects an adjust verdict with no constraint note and changes nothing", async () => {
    const ask = await parkProposal();
    await expect(
      core.answer({
        projectId: PROJECT,
        askId: ask.id,
        expectedVersion: 1,
        proposalVerdict: "adjust",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await backend.asks.findById(PROJECT, ask.id)).toMatchObject({
      state: "OPEN",
      version: 1,
    });
  });

  it("rejects a constraint note on a non-adjust verdict", async () => {
    const ask = await parkProposal();
    await expect(
      core.answer({
        projectId: PROJECT,
        askId: ask.id,
        expectedVersion: 1,
        proposalVerdict: "approve",
        adjustmentNote: "should not be here",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects answering a proposal with no verdict", async () => {
    const ask = await parkProposal();
    await expect(
      core.answer({ projectId: PROJECT, askId: ask.id, expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
