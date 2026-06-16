import { describe, it, expect, beforeEach } from "vitest";
import { createCore, type Core } from "../core.js";
import { NotFoundError } from "../errors.js";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "../testing/in-memory.js";

const PROJECT = "proj-1";

// A narrow read the transport adapters need to assemble response DTOs (e.g. the REST
// answer endpoint reports the owning node's version + blocked state). Project-scoped.
describe("getNode", () => {
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

  it("returns the node by id within its project", async () => {
    const node = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "T",
    });
    const found = await core.getNode(PROJECT, node.id);
    expect(found).toMatchObject({ id: node.id, title: "T", status: "DRAFT", version: 1 });
  });

  it("throws NotFoundError for an unknown node id", async () => {
    await expect(core.getNode(PROJECT, "ghost")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("does not return a node that belongs to another project", async () => {
    backend.seedProject({ id: "other", name: "Other", createdAt: 0 });
    const node = await core.createNode({
      projectId: "other",
      parentId: null,
      kind: "task",
      title: "elsewhere",
    });
    await expect(core.getNode(PROJECT, node.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
