import { describe, it, expect, beforeEach } from "vitest";
import { createCore, type Core } from "../core.js";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "../testing/in-memory.js";

// registerProject creates an isolated board on demand so an agent can park work under its own
// projectId. Idempotent, clock-injected, and event-free (the audit trail starts at the first
// node). No project is seeded in beforeEach — registration is the thing under test.
describe("registerProject", () => {
  let backend: InMemoryBackend;
  let core: Core;

  beforeEach(() => {
    backend = new InMemoryBackend();
    core = createCore({
      uow: backend.uow,
      clock: new FakeClock(1_000),
      ids: new FakeIdGenerator("x"),
    });
  });

  it("creates a new project with the injected clock and makes it usable", async () => {
    const { project, created } = await core.registerProject({ projectId: "alpha", name: "Alpha" });
    expect(created).toBe(true);
    expect(project).toEqual({ id: "alpha", name: "Alpha", createdAt: 1_000 });
    // The new project is a real boundary: a node can be created under it immediately.
    await expect(
      core.createNode({ projectId: "alpha", parentId: null, kind: "goal", title: "G" }),
    ).resolves.toBeDefined();
  });

  it("is idempotent: re-registering returns the existing project with created:false", async () => {
    await core.registerProject({ projectId: "alpha", name: "Alpha" });
    const again = await core.registerProject({ projectId: "alpha", name: "Different Name" });
    expect(again.created).toBe(false);
    expect(again.project.name).toBe("Alpha"); // existing row is not overwritten
  });

  it("emits no event for project creation (audit begins at the first node)", async () => {
    await core.registerProject({ projectId: "alpha", name: "Alpha" });
    const log = await core.readEvents("alpha");
    expect(log.events).toHaveLength(0);
  });
});
