import { describe, it, expect, beforeEach } from "vitest";
import type { WsServerFrame, WsDelta } from "@waypoint/shared";
import { createCore, type Core, StaleVersionError } from "@waypoint/core";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "@waypoint/core/testing";
import { InboxHub } from "../hub.js";
import { createNotifyingCore } from "../notifying-core.js";

const PROJECT = "default";

function sink() {
  const frames: WsServerFrame[] = [];
  return { send: (f: WsServerFrame) => frames.push(f), frames };
}
const deltas = (frames: WsServerFrame[]): WsDelta[] =>
  frames.filter((f): f is WsDelta => f.type === "delta");

describe("createNotifyingCore — single post-commit notify seam", () => {
  let backend: InMemoryBackend;
  let core: Core;
  let hub: InboxHub;
  let notifying: Core;

  beforeEach(() => {
    backend = new InMemoryBackend();
    backend.seedProject({ id: PROJECT, name: "Waypoint", createdAt: 0 });
    core = createCore({
      uow: backend.uow,
      clock: new FakeClock(1_000),
      ids: new FakeIdGenerator("x"),
    });
    hub = new InboxHub(core);
    notifying = createNotifyingCore(core, hub);
  });

  it("publishes exactly one delta per successful mutation", async () => {
    const sub = sink();
    await hub.subscribe(PROJECT, null, sub.send); // initial snapshot
    const before = deltas(sub.frames).length;

    const node = await notifying.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "T",
    });
    const ask = await notifying.parkAsk({
      projectId: PROJECT,
      nodeId: node.id,
      type: "QUESTION",
      prompt: "q",
      required: true,
      options: [],
    });

    const after = deltas(sub.frames);
    expect(after.length - before).toBe(2); // one per mutation
    expect(after.at(-1)!.upserts.map((i) => i.askId)).toEqual([ask.id]);
  });

  it("does not publish a delta when a mutation fails (post-commit only)", async () => {
    const node = await notifying.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "T",
    });
    const ask = await notifying.parkAsk({
      projectId: PROJECT,
      nodeId: node.id,
      type: "QUESTION",
      prompt: "q",
      required: true,
      options: [],
    });
    const sub = sink();
    await hub.subscribe(PROJECT, null, sub.send);
    const before = deltas(sub.frames).length;

    // Stale expected_version → the answer throws and nothing commits.
    await expect(
      notifying.answer({ projectId: PROJECT, askId: ask.id, expectedVersion: 99, answerText: "x" }),
    ).rejects.toBeInstanceOf(StaleVersionError);

    expect(deltas(sub.frames).length).toBe(before); // no broadcast
  });

  it("passes reads through unchanged", async () => {
    const node = await notifying.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "T",
    });
    const inbox = await notifying.listInbox(PROJECT);
    const fetched = await notifying.getNode(PROJECT, node.id);
    expect(inbox.projectId).toBe(PROJECT);
    expect(fetched.id).toBe(node.id);
  });
});
