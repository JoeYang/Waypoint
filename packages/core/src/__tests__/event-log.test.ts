import { describe, it, expect, beforeEach } from "vitest";
import { createCore, type Core } from "../core.js";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "../testing/in-memory.js";

const PROJECT = "proj-1";

describe("append-only event log", () => {
  let backend: InMemoryBackend;
  let core: Core;

  beforeEach(() => {
    backend = new InMemoryBackend();
    core = createCore({
      uow: backend.uow,
      clock: new FakeClock(1_000),
      ids: new FakeIdGenerator("x"),
    });
    backend.seedProject({ id: PROJECT, name: "Waypoint", createdAt: 0 });
  });

  it("appends exactly one monotonic, gapless event per mutation", async () => {
    const node = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "T",
    });
    await core.transition({ projectId: PROJECT, nodeId: node.id, to: "ACTIVE", expectedVersion: 1 });
    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId: node.id,
      type: "QUESTION",
      prompt: "q",
      required: true,
      options: [],
    });
    await core.answer({ projectId: PROJECT, askId: ask.id, expectedVersion: 1, answerText: "yes" });

    const events = await backend.events.listSince(PROJECT, 0);
    expect(events.map((e) => e.seq)).toEqual([1, 2, 3, 4]);
    expect(events.map((e) => e.verb)).toEqual([
      "node.created",
      "node.transitioned",
      "ask.parked",
      "ask.answered",
    ]);
  });

  it("emits exactly one event for an overturn even though it writes two rows", async () => {
    const node = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "T",
    });
    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId: node.id,
      type: "DECISION",
      prompt: "p",
      required: true,
      options: ["a", "b"],
    });
    await core.assume({ projectId: PROJECT, askId: ask.id, assumption: "a", expectedVersion: 1 });
    const before = (await backend.events.listSince(PROJECT, 0)).length;

    await core.overturnAssumption({ projectId: PROJECT, askId: ask.id, expectedVersion: 2 });

    const after = await backend.events.listSince(PROJECT, 0);
    expect(after.length).toBe(before + 1);
    expect(after.at(-1)).toMatchObject({ verb: "ask.overturned" });
  });

  it("keeps per-project seq independent", async () => {
    backend.seedProject({ id: "proj-2", name: "Other", createdAt: 0 });
    await core.createNode({ projectId: PROJECT, parentId: null, kind: "goal", title: "A" });
    await core.createNode({ projectId: "proj-2", parentId: null, kind: "goal", title: "B" });

    expect((await backend.events.listSince(PROJECT, 0))[0]?.seq).toBe(1);
    expect((await backend.events.listSince("proj-2", 0))[0]?.seq).toBe(1);
  });

  it("does not emit extra events for derived recompute across dependents", async () => {
    const a = await core.createNode({ projectId: PROJECT, parentId: null, kind: "task", title: "A" });
    const b = await core.createNode({ projectId: PROJECT, parentId: null, kind: "task", title: "B" });
    const c = await core.createNode({ projectId: PROJECT, parentId: null, kind: "task", title: "C" });
    await core.addDependency({ projectId: PROJECT, nodeId: b.id, dependsOnId: a.id });
    await core.addDependency({ projectId: PROJECT, nodeId: c.id, dependsOnId: a.id });
    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId: a.id,
      type: "QUESTION",
      prompt: "q",
      required: true,
      options: [],
    });
    const before = (await backend.events.listSince(PROJECT, 0)).length;

    await core.answer({ projectId: PROJECT, askId: ask.id, expectedVersion: 1, answerText: "ok" });

    const after = await backend.events.listSince(PROJECT, 0);
    expect(after.length).toBe(before + 1); // only the answer; no per-dependent events
  });
});
