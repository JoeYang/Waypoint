import { describe, it, expect, beforeEach } from "vitest";
import { createCore, type Core } from "../core.js";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "../testing/in-memory.js";
import { NotFoundError } from "../errors.js";

const PROJECT = "proj-1";

describe("getContext — the agent context pack", () => {
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

  it("summarises goal, open asks with blast radius, recent decisions, and provenance", async () => {
    const goal = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "goal",
      title: "Ship the MVP",
    });
    const task = await core.createNode({
      projectId: PROJECT,
      parentId: goal.id,
      kind: "task",
      title: "Pick a database",
    });
    // Two nodes depend on the task → blast radius 2 for asks on it.
    for (const t of ["dep-1", "dep-2"]) {
      const d = await core.createNode({ projectId: PROJECT, parentId: null, kind: "task", title: t });
      await core.addDependency({ projectId: PROJECT, nodeId: d.id, dependsOnId: task.id });
    }
    const openAsk = await core.parkAsk({
      projectId: PROJECT,
      nodeId: task.id,
      type: "DECISION",
      prompt: "Postgres or SQLite?",
      required: true,
      options: ["Postgres", "SQLite"],
    });
    const resolved = await core.parkAsk({
      projectId: PROJECT,
      nodeId: task.id,
      type: "QUESTION",
      prompt: "Which region?",
      required: false,
      options: [],
    });
    await core.answer({
      projectId: PROJECT,
      askId: resolved.id,
      expectedVersion: 1,
      answerText: "us-east-1",
      sessionId: "sess-last",
    });

    const pack = await core.getContext(PROJECT);

    expect(pack.project).toEqual({ id: PROJECT, name: "Waypoint" });
    expect(pack.goal).toBe("Ship the MVP");
    expect(pack.openAsks).toEqual([
      {
        id: openAsk.id,
        nodeId: task.id,
        type: "DECISION",
        prompt: "Postgres or SQLite?",
        required: true,
        blastRadius: 2,
      },
    ]);
    expect(pack.recentDecisions).toEqual([
      { askId: resolved.id, prompt: "Which region?", resolution: "us-east-1", at: 1_000 },
    ]);
    expect(pack.provenance.lastSessionId).toBe("sess-last");
  });

  it("returns a null goal when there is no root goal node", async () => {
    await core.createNode({ projectId: PROJECT, parentId: null, kind: "task", title: "loose task" });
    const pack = await core.getContext(PROJECT);
    expect(pack.goal).toBeNull();
    expect(pack.openAsks).toEqual([]);
  });

  it("rejects an unknown project", async () => {
    await expect(core.getContext("ghost")).rejects.toBeInstanceOf(NotFoundError);
  });
});
