import { describe, it, expect, beforeEach } from "vitest";
import { createCore, type Core } from "../core.js";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "../testing/in-memory.js";
import { NotFoundError } from "../errors.js";

// live-wiring PR2: the project event-log read model (the Activity timeline source).
describe("readEvents — the project event log", () => {
  let backend: InMemoryBackend;
  let core: Core;

  beforeEach(() => {
    backend = new InMemoryBackend();
    core = createCore({
      uow: backend.uow,
      clock: new FakeClock(1_000),
      ids: new FakeIdGenerator("x"),
    });
    backend.seedProject({ id: "p1", name: "orbit-api", createdAt: 0 });
  });

  it("returns the project's events in append order with the current seq", async () => {
    const node = await core.createNode({
      projectId: "p1",
      parentId: null,
      kind: "task",
      title: "T",
    });
    await core.parkAsk({
      projectId: "p1",
      nodeId: node.id,
      type: "DECISION",
      prompt: "Which?",
      required: true,
      options: ["A", "B"],
    });

    const res = await core.readEvents("p1");
    expect(res.projectId).toBe("p1");
    expect(res.events.map((e) => e.verb)).toEqual(["node.created", "ask.parked"]);
    expect(res.seq).toBe(res.events[res.events.length - 1]?.seq);
  });

  it("filters to events strictly after sinceSeq, holding position when none are newer", async () => {
    const node = await core.createNode({
      projectId: "p1",
      parentId: null,
      kind: "task",
      title: "T",
    });
    const full = await core.readEvents("p1");
    const latest = full.seq;

    const empty = await core.readEvents("p1", latest);
    expect(empty.events).toEqual([]);
    expect(empty.seq).toBe(latest);

    // sinceSeq = 1 drops the first event, keeps the rest.
    await core.parkAsk({
      projectId: "p1",
      nodeId: node.id,
      type: "DECISION",
      prompt: "?",
      required: true,
      options: ["A", "B"],
    });
    const since1 = await core.readEvents("p1", 1);
    expect(since1.events.every((e) => e.seq > 1)).toBe(true);
  });

  it("rejects an unknown project", async () => {
    await expect(core.readEvents("ghost")).rejects.toBeInstanceOf(NotFoundError);
  });
});
