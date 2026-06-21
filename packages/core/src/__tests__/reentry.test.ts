import { describe, it, expect, beforeEach } from "vitest";
import { createCore, type Core } from "../core.js";
import { decideEscalation } from "../reentry.js";
import { stableAliasFromSession } from "../projections.js";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "../testing/in-memory.js";
import { NotFoundError } from "../errors.js";

const PROJECT = "proj-1";

// A tiny scenario builder over the real use-cases, so story/digest project genuine events.
function harness() {
  const backend = new InMemoryBackend();
  const clock = new FakeClock(1_000);
  const core = createCore({ uow: backend.uow, clock, ids: new FakeIdGenerator("n") });
  backend.seedProject({ id: PROJECT, name: "Waypoint", createdAt: 0 });
  return { backend, clock, core };
}

describe("decideEscalation (pure, boundaries)", () => {
  const policy = { blastRadiusThreshold: 3, ageSlaSeconds: 3600, digestCadenceSeconds: 86400 };

  it("pushes with reason 'threshold' when blast radius crosses the threshold", () => {
    expect(
      decideEscalation({ askId: "a", blastRadius: 5, ageSeconds: 0, waitingCount: 1 }, policy),
    ).toEqual({ push: true, reason: "threshold" });
  });

  it("pushes at the exact threshold boundary (>=)", () => {
    expect(
      decideEscalation({ askId: "a", blastRadius: 3, ageSeconds: 0, waitingCount: 1 }, policy).push,
    ).toBe(true);
  });

  it("pushes with reason 'sla' when aged past the SLA but under the blast threshold", () => {
    expect(
      decideEscalation({ askId: "a", blastRadius: 0, ageSeconds: 3600, waitingCount: 1 }, policy),
    ).toEqual({ push: true, reason: "sla" });
  });

  it("batches (no push) when neither threshold nor SLA is met", () => {
    expect(
      decideEscalation({ askId: "a", blastRadius: 2, ageSeconds: 10, waitingCount: 1 }, policy),
    ).toEqual({ push: false, reason: "none" });
  });

  it("prefers 'threshold' over 'sla' when both are met", () => {
    expect(
      decideEscalation({ askId: "a", blastRadius: 9, ageSeconds: 9999, waitingCount: 1 }, policy)
        .reason,
    ).toBe("threshold");
  });
});

describe("core.story — threaded narrative over the event log", () => {
  let core: Core;
  beforeEach(() => {
    ({ core } = harness());
  });

  it("returns entries oldest-first, each threaded to its node", async () => {
    const a = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "A",
    });
    const b = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "B",
    });
    const { entries, seq } = await core.story(PROJECT);
    expect(entries.map((e) => e.seq)).toEqual([1, 2]);
    expect(entries[0]?.nodeId).toBe(a.id);
    expect(entries[1]?.nodeId).toBe(b.id);
    expect(seq).toBe(2);
  });

  it("resolves the actor label from the session id, and null when unattributed", async () => {
    await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "labelled",
      sessionId: "sess-A",
    });
    await core.createNode({ projectId: PROJECT, parentId: null, kind: "task", title: "anon" });
    const { entries } = await core.story(PROJECT);
    expect(entries[0]?.actorLabel).toBe(stableAliasFromSession("sess-A"));
    expect(entries[1]?.actorLabel).toBeNull();
  });

  it("threads an ask event under the ask's node, not the ask id", async () => {
    const node = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "needs a call",
    });
    await core.parkAsk({
      projectId: PROJECT,
      nodeId: node.id,
      type: "QUESTION",
      prompt: "which?",
      required: true,
      options: [],
    });
    const { entries } = await core.story(PROJECT);
    const askEntry = entries.find((e) => e.verb === "ask.parked");
    expect(askEntry?.nodeId).toBe(node.id);
  });

  it("filters to events strictly after sinceSeq", async () => {
    await core.createNode({ projectId: PROJECT, parentId: null, kind: "task", title: "A" });
    await core.createNode({ projectId: PROJECT, parentId: null, kind: "task", title: "B" });
    const { entries } = await core.story(PROJECT, 1);
    expect(entries.map((e) => e.seq)).toEqual([2]);
  });

  it("bounds the read to the most recent `limit` events", async () => {
    for (const t of ["A", "B", "C"]) {
      await core.createNode({ projectId: PROJECT, parentId: null, kind: "task", title: t });
    }
    const { entries } = await core.story(PROJECT, 0, 2);
    expect(entries.map((e) => e.seq)).toEqual([2, 3]);
  });

  it("is a pure projection — reading the story does not mutate the event log", async () => {
    await core.createNode({ projectId: PROJECT, parentId: null, kind: "task", title: "A" });
    const before = await core.readEvents(PROJECT);
    await core.story(PROJECT);
    const after = await core.readEvents(PROJECT);
    expect(after.events).toEqual(before.events);
  });

  it("rejects an unknown project", async () => {
    await expect(core.story("ghost")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("core.digest — while-you-were-away", () => {
  let core: Core;
  let clock: FakeClock;
  beforeEach(() => {
    ({ core, clock } = harness());
  });

  it("lists shipped nodes that reached DONE in the window", async () => {
    const t = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "ship me",
    });
    await core.transition({ projectId: PROJECT, nodeId: t.id, to: "ACTIVE", expectedVersion: 1 });
    await core.transition({ projectId: PROJECT, nodeId: t.id, to: "DONE", expectedVersion: 2 });
    const d = await core.digest(PROJECT, 0);
    expect(d.shipped.map((n) => n.nodeId)).toContain(t.id);
    expect(d.newlyBlocked).toHaveLength(0);
  });

  it("lists newly-blocked nodes that gained a required open ask and are still blocked", async () => {
    const t = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "blocked",
    });
    await core.parkAsk({
      projectId: PROJECT,
      nodeId: t.id,
      type: "QUESTION",
      prompt: "which?",
      required: true,
      options: [],
    });
    const d = await core.digest(PROJECT, 0);
    expect(d.newlyBlocked.map((n) => n.nodeId)).toContain(t.id);
    expect(d.waiting.map((a) => a.nodeId)).toContain(t.id);
  });

  it("ranks waiting asks by blast radius desc, then longest wait", async () => {
    const big = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "big",
    });
    const small = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "small",
    });
    // Two nodes depend on `big`, none on `small` → big has the larger blast radius.
    for (const title of ["d1", "d2"]) {
      const dep = await core.createNode({
        projectId: PROJECT,
        parentId: null,
        kind: "task",
        title,
      });
      await core.addDependency({ projectId: PROJECT, nodeId: dep.id, dependsOnId: big.id });
    }
    await core.parkAsk({
      projectId: PROJECT,
      nodeId: small.id,
      type: "QUESTION",
      prompt: "?",
      required: true,
      options: [],
    });
    await core.parkAsk({
      projectId: PROJECT,
      nodeId: big.id,
      type: "QUESTION",
      prompt: "?",
      required: true,
      options: [],
    });
    const d = await core.digest(PROJECT, 0);
    expect(d.waiting[0]?.nodeId).toBe(big.id);
    expect(d.waiting[0]?.blastRadius).toBe(2);
  });

  it("reports the ask's wait time as ageMs from the clock", async () => {
    const t = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "aging",
    });
    await core.parkAsk({
      projectId: PROJECT,
      nodeId: t.id,
      type: "QUESTION",
      prompt: "?",
      required: true,
      options: [],
    });
    clock.tick(5_000);
    const d = await core.digest(PROJECT, 0);
    expect(d.waiting.find((a) => a.nodeId === t.id)?.ageMs).toBe(5_000);
  });

  it("is empty and echoes the cursor when nothing changed since last-seen", async () => {
    await core.createNode({ projectId: PROJECT, parentId: null, kind: "task", title: "A" });
    const latest = (await core.readEvents(PROJECT)).seq;
    const d = await core.digest(PROJECT, latest);
    expect(d.shipped).toHaveLength(0);
    expect(d.newlyBlocked).toHaveLength(0);
    expect(d.sinceSeq).toBe(latest);
  });

  it("rejects an unknown project", async () => {
    await expect(core.digest("ghost", 0)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("core.evaluateEscalation", () => {
  let core: Core;
  let clock: FakeClock;
  const policy = { blastRadiusThreshold: 2, ageSlaSeconds: 3600, digestCadenceSeconds: 86400 };
  beforeEach(() => {
    ({ core, clock } = harness());
  });

  it("recomputes blast radius at notify-time and escalates on threshold", async () => {
    const node = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "hot",
    });
    for (const title of ["d1", "d2"]) {
      const dep = await core.createNode({
        projectId: PROJECT,
        parentId: null,
        kind: "task",
        title,
      });
      await core.addDependency({ projectId: PROJECT, nodeId: dep.id, dependsOnId: node.id });
    }
    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId: node.id,
      type: "QUESTION",
      prompt: "?",
      required: true,
      options: [],
    });
    const { decision, input } = await core.evaluateEscalation(PROJECT, ask.id, policy);
    expect(input.blastRadius).toBe(2);
    expect(input.waitingCount).toBe(1);
    expect(decision).toEqual({ push: true, reason: "threshold" });
  });

  it("escalates on SLA once the ask ages past it (blast under threshold)", async () => {
    const node = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "old",
    });
    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId: node.id,
      type: "QUESTION",
      prompt: "?",
      required: true,
      options: [],
    });
    clock.tick(3_600_000); // 1h
    const { decision } = await core.evaluateEscalation(PROJECT, ask.id, policy);
    expect(decision).toEqual({ push: true, reason: "sla" });
  });

  it("batches a low-impact, fresh ask", async () => {
    const node = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "quiet",
    });
    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId: node.id,
      type: "QUESTION",
      prompt: "?",
      required: true,
      options: [],
    });
    const { decision } = await core.evaluateEscalation(PROJECT, ask.id, policy);
    expect(decision).toEqual({ push: false, reason: "none" });
  });

  it("rejects an unknown ask", async () => {
    await expect(core.evaluateEscalation(PROJECT, "ghost", policy)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
