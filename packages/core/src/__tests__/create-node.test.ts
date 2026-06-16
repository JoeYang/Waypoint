import { describe, it, expect, beforeEach } from "vitest";
import { createCore, type Core } from "../core.js";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "../testing/in-memory.js";
import { NotFoundError, ValidationError } from "../errors.js";

const PROJECT = "proj-1";

describe("createNode — node hierarchy within a project", () => {
  let backend: InMemoryBackend;
  let clock: FakeClock;
  let core: Core;

  beforeEach(() => {
    backend = new InMemoryBackend();
    clock = new FakeClock(1_000);
    core = createCore({ uow: backend.uow, clock, ids: new FakeIdGenerator("node") });
    backend.seedProject({ id: PROJECT, name: "Waypoint", createdAt: 0 });
  });

  it("creates a root node in DRAFT at version 1 with the clock timestamp", async () => {
    const node = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "goal",
      title: "Ship the MVP",
    });

    expect(node.id).toBeTruthy();
    expect(node.status).toBe("DRAFT");
    expect(node.version).toBe(1);
    expect(node.parentId).toBeNull();
    expect(node.createdAt).toBe(1_000);
    expect(node.discardReason).toBeNull();
  });

  it("allows skippable levels — a goal may directly parent a task", async () => {
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
      title: "Scaffold monorepo",
    });

    expect(task.parentId).toBe(goal.id);
  });

  it("records session provenance when supplied", async () => {
    const node = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "goal",
      title: "Ship the MVP",
      sessionId: "sess-abc",
    });
    expect(node.sessionId).toBe("sess-abc");
  });

  it("appends exactly one node.created event with seq 1 by the agent", async () => {
    const node = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "goal",
      title: "Ship the MVP",
    });
    const events = await backend.events.listSince(PROJECT, 0);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      seq: 1,
      verb: "node.created",
      actor: "agent",
      ref: { kind: "node", id: node.id },
    });
  });

  it("rejects an unknown project and creates nothing", async () => {
    await expect(
      core.createNode({ projectId: "ghost", parentId: null, kind: "goal", title: "x" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await backend.nodes.listByProject("ghost")).toHaveLength(0);
  });

  it("rejects a parent from another project and creates nothing", async () => {
    const other = new InMemoryBackend();
    other.seedProject({ id: "proj-2", name: "Other", createdAt: 0 });
    const otherCore = createCore({
      uow: other.uow,
      clock,
      ids: new FakeIdGenerator("other"),
    });
    const foreign = await otherCore.createNode({
      projectId: "proj-2",
      parentId: null,
      kind: "goal",
      title: "Foreign goal",
    });

    await expect(
      core.createNode({ projectId: PROJECT, parentId: foreign.id, kind: "task", title: "x" }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await backend.nodes.listByProject(PROJECT)).toHaveLength(0);
    expect(await backend.events.listSince(PROJECT, 0)).toHaveLength(0);
  });
});
