import { describe, it, expect, beforeEach } from "vitest";
import { createCore, type Core } from "../core.js";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "../testing/in-memory.js";

const PROJECT = "proj-1";

describe("computed blast_radius (direct dependents)", () => {
  let backend: InMemoryBackend;
  let core: Core;

  const task = (title: string) =>
    core.createNode({ projectId: PROJECT, parentId: null, kind: "task", title });

  beforeEach(() => {
    backend = new InMemoryBackend();
    core = createCore({
      uow: backend.uow,
      clock: new FakeClock(1_000),
      ids: new FakeIdGenerator("x"),
    });
    backend.seedProject({ id: PROJECT, name: "Waypoint", createdAt: 0 });
  });

  it("counts the nodes that directly depend on a node", async () => {
    const a = await task("A");
    for (const t of ["B", "C", "D"]) {
      const n = await task(t);
      await core.addDependency({ projectId: PROJECT, nodeId: n.id, dependsOnId: a.id });
    }
    expect(await core.blastRadius(PROJECT, a.id)).toBe(3);
  });

  it("is zero when nothing depends on the node", async () => {
    const a = await task("A");
    expect(await core.blastRadius(PROJECT, a.id)).toBe(0);
  });

  it("counts direct dependents only, not transitive ones", async () => {
    const a = await task("A");
    const b = await task("B");
    const c = await task("C");
    await core.addDependency({ projectId: PROJECT, nodeId: b.id, dependsOnId: a.id });
    await core.addDependency({ projectId: PROJECT, nodeId: c.id, dependsOnId: b.id });
    // C depends on B depends on A. A's direct dependents = {B} only.
    expect(await core.blastRadius(PROJECT, a.id)).toBe(1);
  });
});
