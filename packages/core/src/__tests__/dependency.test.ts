import { describe, it, expect, beforeEach } from "vitest";
import { createCore, type Core } from "../core.js";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "../testing/in-memory.js";
import { ValidationError } from "../errors.js";

const PROJECT = "proj-1";

describe("addDependency — depends_on edges", () => {
  let backend: InMemoryBackend;
  let core: Core;

  const newNode = (title: string) =>
    core.createNode({ projectId: PROJECT, parentId: null, kind: "task", title });

  beforeEach(() => {
    backend = new InMemoryBackend();
    core = createCore({
      uow: backend.uow,
      clock: new FakeClock(1_000),
      ids: new FakeIdGenerator("node"),
    });
    backend.seedProject({ id: PROJECT, name: "Waypoint", createdAt: 0 });
  });

  it("records a directed edge and appends a dependency.added event", async () => {
    const a = await newNode("A");
    const b = await newNode("B");

    await core.addDependency({ projectId: PROJECT, nodeId: b.id, dependsOnId: a.id });

    const edges = await backend.nodes.listDependencies(PROJECT);
    expect(edges).toEqual([{ projectId: PROJECT, nodeId: b.id, dependsOnId: a.id }]);
    const events = await backend.events.listSince(PROJECT, 0);
    expect(events.at(-1)).toMatchObject({ verb: "dependency.added", ref: { id: b.id } });
  });

  it("rejects a self-dependency and adds nothing", async () => {
    const a = await newNode("A");
    await expect(
      core.addDependency({ projectId: PROJECT, nodeId: a.id, dependsOnId: a.id }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await backend.nodes.listDependencies(PROJECT)).toHaveLength(0);
  });

  it("rejects an edge that would create a cycle, leaving prior edges intact", async () => {
    const a = await newNode("A");
    const b = await newNode("B");
    const c = await newNode("C");
    // A → B → C, then C → A would close a cycle.
    await core.addDependency({ projectId: PROJECT, nodeId: a.id, dependsOnId: b.id });
    await core.addDependency({ projectId: PROJECT, nodeId: b.id, dependsOnId: c.id });

    await expect(
      core.addDependency({ projectId: PROJECT, nodeId: c.id, dependsOnId: a.id }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await backend.nodes.listDependencies(PROJECT)).toHaveLength(2);
  });

  it("rejects a dependency target from another project", async () => {
    const b = await newNode("B");
    const other = new InMemoryBackend();
    other.seedProject({ id: "proj-2", name: "Other", createdAt: 0 });
    const otherCore = createCore({
      uow: other.uow,
      clock: new FakeClock(1_000),
      ids: new FakeIdGenerator("other"),
    });
    const foreign = await otherCore.createNode({
      projectId: "proj-2",
      parentId: null,
      kind: "task",
      title: "Foreign",
    });

    await expect(
      core.addDependency({ projectId: PROJECT, nodeId: b.id, dependsOnId: foreign.id }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await backend.nodes.listDependencies(PROJECT)).toHaveLength(0);
  });

  it("rejects an edge whose dependent node does not exist", async () => {
    const a = await newNode("A");
    await expect(
      core.addDependency({ projectId: PROJECT, nodeId: "ghost", dependsOnId: a.id }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
