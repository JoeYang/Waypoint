import { describe, it, expect, beforeEach } from "vitest";
import type { WsServerFrame, WsDelta, WsDigestReady } from "@waypoint/shared";
import { DEFAULT_PRINCIPAL } from "@waypoint/shared";
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
const digestReady = (frames: WsServerFrame[]): WsDigestReady[] =>
  frames.filter((f): f is WsDigestReady => f.type === "digest.ready");

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

  it("still returns the mutation result when the live push fails (best-effort notify)", async () => {
    // The durable event log + resume-since-seq are the source of truth; a failing live push
    // must never fail the caller's mutation. Inject a hub whose notify always throws.
    const throwingHub = {
      notify: async () => {
        throw new Error("broadcast down");
      },
    } as unknown as InboxHub;
    const resilient = createNotifyingCore(core, throwingHub);

    const node = await resilient.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "T",
    });
    // The mutation committed and its result is returned despite the notify failure.
    expect(node.id).toBeTruthy();
    expect(await backend.nodes.findById(PROJECT, node.id)).toMatchObject({ id: node.id });
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

describe("createNotifyingCore — tiered notifier (digest.ready escalation)", () => {
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

  // A node with one dependent so a parked ask on it has blast radius 1.
  async function nodeWithDependent(): Promise<string> {
    const target = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "target",
    });
    const dep = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "dependent",
    });
    await core.addDependency({ projectId: PROJECT, nodeId: dep.id, dependsOnId: target.id });
    return target.id;
  }

  it("escalates a single digest.ready when blast radius crosses the threshold", async () => {
    await core.setPolicyFor(PROJECT, DEFAULT_PRINCIPAL, {
      blastRadiusThreshold: 1,
      ageSlaSeconds: 999_999,
      digestCadenceSeconds: 86_400,
    });
    const nodeId = await nodeWithDependent();
    const sub = sink();
    await hub.subscribe(PROJECT, null, sub.send);

    const ask = await notifying.parkAsk({
      projectId: PROJECT,
      nodeId,
      type: "QUESTION",
      prompt: "secret prompt",
      required: true,
      options: [],
    });

    const pushes = digestReady(sub.frames);
    expect(pushes).toHaveLength(1);
    expect(pushes[0]).toMatchObject({ reason: "threshold", askId: ask.id });
    // Carries a non-sensitive summary only — never the prompt (security.md).
    expect(pushes[0]!.summary).not.toContain("secret prompt");
  });

  it("does NOT escalate a low-impact, fresh ask (it batches into the digest)", async () => {
    await core.setPolicyFor(PROJECT, DEFAULT_PRINCIPAL, {
      blastRadiusThreshold: 5,
      ageSlaSeconds: 999_999,
      digestCadenceSeconds: 86_400,
    });
    const node = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "quiet",
    });
    const sub = sink();
    await hub.subscribe(PROJECT, null, sub.send);
    await notifying.parkAsk({
      projectId: PROJECT,
      nodeId: node.id,
      type: "QUESTION",
      prompt: "q",
      required: true,
      options: [],
    });
    expect(digestReady(sub.frames)).toHaveLength(0);
    // The delta still fires — the ask is in the inbox, just not pushed.
    expect(deltas(sub.frames).at(-1)!.upserts.length).toBeGreaterThan(0);
  });

  it("never emits one push per ask — only the escalating one pushes", async () => {
    await core.setPolicyFor(PROJECT, DEFAULT_PRINCIPAL, {
      blastRadiusThreshold: 1,
      ageSlaSeconds: 999_999,
      digestCadenceSeconds: 86_400,
    });
    const hot = await nodeWithDependent(); // blast radius 1 → escalates
    const cold = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "cold",
    }); // blast radius 0 → batches
    const sub = sink();
    await hub.subscribe(PROJECT, null, sub.send);

    await notifying.parkAsk({
      projectId: PROJECT,
      nodeId: cold.id,
      type: "QUESTION",
      prompt: "c",
      required: true,
      options: [],
    });
    await notifying.parkAsk({
      projectId: PROJECT,
      nodeId: hot,
      type: "QUESTION",
      prompt: "h",
      required: true,
      options: [],
    });

    expect(digestReady(sub.frames)).toHaveLength(1); // only the hot ask pushed
  });

  it("failure injection: a broadcast/notify transport down never fails the park", async () => {
    await core.setPolicyFor(PROJECT, DEFAULT_PRINCIPAL, {
      blastRadiusThreshold: 1,
      ageSlaSeconds: 999_999,
      digestCadenceSeconds: 86_400,
    });
    const nodeId = await nodeWithDependent();
    // A hub whose notify AND broadcast both throw — the transport is fully down.
    const deadHub = {
      notify: async () => {
        throw new Error("notify down");
      },
      broadcast: () => {
        throw new Error("broadcast down");
      },
    } as unknown as InboxHub;
    const resilient = createNotifyingCore(core, deadHub);

    const ask = await resilient.parkAsk({
      projectId: PROJECT,
      nodeId,
      type: "QUESTION",
      prompt: "q",
      required: true,
      options: [],
    });
    // The park committed despite the dead transport, and the digest still surfaces it on return.
    expect(ask.id).toBeTruthy();
    const digest = await core.digestFor(PROJECT, DEFAULT_PRINCIPAL);
    expect(digest.waiting.map((a) => a.askId)).toContain(ask.id);
  });
});
