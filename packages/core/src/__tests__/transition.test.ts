import { describe, it, expect, beforeEach } from "vitest";
import { createCore, type Core } from "../core.js";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "../testing/in-memory.js";
import { ValidationError, StaleVersionError } from "../errors.js";

const PROJECT = "proj-1";

describe("transition — node status spine", () => {
  let backend: InMemoryBackend;
  let core: Core;

  const draftNode = () =>
    core.createNode({ projectId: PROJECT, parentId: null, kind: "task", title: "T" });

  beforeEach(() => {
    backend = new InMemoryBackend();
    core = createCore({
      uow: backend.uow,
      clock: new FakeClock(1_000),
      ids: new FakeIdGenerator("node"),
    });
    backend.seedProject({ id: PROJECT, name: "Waypoint", createdAt: 0 });
  });

  it("moves DRAFT → ACTIVE, increments version, appends one event", async () => {
    const node = await draftNode();
    const active = await core.transition({
      projectId: PROJECT,
      nodeId: node.id,
      to: "ACTIVE",
      expectedVersion: 1,
    });

    expect(active.status).toBe("ACTIVE");
    expect(active.version).toBe(2);
    const events = await backend.events.listSince(PROJECT, 0);
    expect(events.at(-1)).toMatchObject({ verb: "node.transitioned", ref: { id: node.id } });
  });

  it("allows ACTIVE → DONE with the matching version", async () => {
    const node = await draftNode();
    await core.transition({ projectId: PROJECT, nodeId: node.id, to: "ACTIVE", expectedVersion: 1 });
    const done = await core.transition({
      projectId: PROJECT,
      nodeId: node.id,
      to: "DONE",
      expectedVersion: 2,
    });
    expect(done.status).toBe("DONE");
    expect(done.version).toBe(3);
  });

  it("rejects DISCARDED without a reason and leaves the node unchanged", async () => {
    const node = await draftNode();
    await expect(
      core.transition({ projectId: PROJECT, nodeId: node.id, to: "DISCARDED", expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(ValidationError);
    const after = await backend.nodes.findById(PROJECT, node.id);
    expect(after).toMatchObject({ status: "DRAFT", version: 1 });
  });

  it("records the reason when discarding", async () => {
    const node = await draftNode();
    const discarded = await core.transition({
      projectId: PROJECT,
      nodeId: node.id,
      to: "DISCARDED",
      reason: "superseded by goal redesign",
      expectedVersion: 1,
    });
    expect(discarded.status).toBe("DISCARDED");
    expect(discarded.discardReason).toBe("superseded by goal redesign");
  });

  it("rejects an illegal spine move (DRAFT → DONE) and leaves the node unchanged", async () => {
    const node = await draftNode();
    await expect(
      core.transition({ projectId: PROJECT, nodeId: node.id, to: "DONE", expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await backend.nodes.findById(PROJECT, node.id)).toMatchObject({
      status: "DRAFT",
      version: 1,
    });
  });

  it("rejects a stale expected_version and leaves the node unchanged", async () => {
    const node = await draftNode();
    await expect(
      core.transition({ projectId: PROJECT, nodeId: node.id, to: "ACTIVE", expectedVersion: 99 }),
    ).rejects.toBeInstanceOf(StaleVersionError);
    expect(await backend.nodes.findById(PROJECT, node.id)).toMatchObject({
      status: "DRAFT",
      version: 1,
    });
  });
});
