import { describe, it, expect, beforeEach } from "vitest";
import { createCore, type Core } from "../core.js";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "../testing/in-memory.js";
import { StaleVersionError } from "../errors.js";

const PROJECT = "proj-1";

describe("optimistic concurrency", () => {
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

  it("rejects a stale write and reports the current version", async () => {
    const node = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "T",
    });
    await core.transition({ projectId: PROJECT, nodeId: node.id, to: "ACTIVE", expectedVersion: 1 });

    const err = await core
      .transition({ projectId: PROJECT, nodeId: node.id, to: "DONE", expectedVersion: 1 })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(StaleVersionError);
    expect((err as StaleVersionError).actualVersion).toBe(2);
    // Unchanged.
    expect(await backend.nodes.findById(PROJECT, node.id)).toMatchObject({
      status: "ACTIVE",
      version: 2,
    });
  });

  it("resolves the overturn-while-done race: agent's DONE is rejected, node reflects overturn", async () => {
    // Agent activates a node and proceeds on an assumption.
    const node = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "Ship it",
    });
    await core.transition({ projectId: PROJECT, nodeId: node.id, to: "ACTIVE", expectedVersion: 1 });
    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId: node.id,
      type: "DECISION",
      prompt: "approach?",
      required: true,
      options: ["A", "B"],
    });
    await core.assume({ projectId: PROJECT, askId: ask.id, assumption: "A", expectedVersion: 1 });
    // Agent still holds node version 2 (assume did not bump the node).

    // Concurrently, a human overturns the assumption — bumping the node to version 3.
    await core.overturnAssumption({ projectId: PROJECT, askId: ask.id, expectedVersion: 2 });

    // The agent's in-flight DONE, premised on version 2, must be rejected as stale.
    await expect(
      core.transition({ projectId: PROJECT, nodeId: node.id, to: "DONE", expectedVersion: 2 }),
    ).rejects.toBeInstanceOf(StaleVersionError);

    const after = await backend.nodes.findById(PROJECT, node.id);
    expect(after).toMatchObject({ status: "ACTIVE", version: 3 });
  });
});
