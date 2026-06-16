import { describe, it, expect, beforeEach } from "vitest";
import type { WsServerFrame, WsDelta } from "@waypoint/shared";
import { createCore, type Core } from "@waypoint/core";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "@waypoint/core/testing";
import { InboxHub } from "../hub.js";

const PROJECT = "default";

// A subscriber that records every frame the hub pushes to it.
function sink() {
  const frames: WsServerFrame[] = [];
  return { send: (f: WsServerFrame) => frames.push(f), frames };
}

const deltas = (frames: WsServerFrame[]): WsDelta[] =>
  frames.filter((f): f is WsDelta => f.type === "delta");

describe("InboxHub — live inbox deltas + resume", () => {
  let backend: InMemoryBackend;
  let clock: FakeClock;
  let core: Core;
  let hub: InboxHub;

  const task = (title: string) =>
    core.createNode({ projectId: PROJECT, parentId: null, kind: "task", title });

  const park = (nodeId: string, prompt: string) =>
    core.parkAsk({
      projectId: PROJECT,
      nodeId,
      type: "QUESTION",
      prompt,
      required: true,
      options: [],
    });

  beforeEach(() => {
    backend = new InMemoryBackend();
    backend.seedProject({ id: PROJECT, name: "Waypoint", createdAt: 0 });
    clock = new FakeClock(1_000);
    core = createCore({ uow: backend.uow, clock, ids: new FakeIdGenerator("x") });
    hub = new InboxHub(core, { retain: 8 });
  });

  it("sends a fresh full snapshot to a subscriber that resumes from null", async () => {
    const n = await task("n");
    const ask = await park(n.id, "q");
    const sub = sink();

    await hub.subscribe(PROJECT, null, sub.send);

    expect(sub.frames).toHaveLength(1);
    const [first] = deltas(sub.frames);
    expect(first).toMatchObject({ type: "delta", seq: 2, removedAskIds: [] });
    expect(first!.upserts.map((i) => i.askId)).toEqual([ask.id]);
  });

  it("sends an empty seq-0 snapshot for a project with no events", async () => {
    const sub = sink();
    await hub.subscribe(PROJECT, null, sub.send);
    expect(deltas(sub.frames)[0]).toMatchObject({ seq: 0, upserts: [], removedAskIds: [] });
  });

  it("broadcasts an upsert delta to live subscribers when an ask is parked", async () => {
    const sub = sink();
    await hub.subscribe(PROJECT, null, sub.send); // initial empty snapshot
    const n = await task("n");
    const ask = await park(n.id, "q");

    await hub.notify(PROJECT); // post-commit notify

    const d = deltas(sub.frames);
    expect(d).toHaveLength(2); // snapshot + one live delta
    expect(d[1]).toMatchObject({ seq: 2, removedAskIds: [] });
    expect(d[1]!.upserts.map((i) => i.askId)).toEqual([ask.id]);
  });

  it("emits the resolved ask as removed when it leaves the queue", async () => {
    const n = await task("n");
    const ask = await park(n.id, "q");
    const sub = sink();
    await hub.subscribe(PROJECT, null, sub.send); // snapshot shows the open ask

    await core.answer({ projectId: PROJECT, askId: ask.id, expectedVersion: 1, answerText: "yes" });
    await hub.notify(PROJECT);

    const last = deltas(sub.frames).at(-1)!;
    expect(last.upserts).toHaveLength(0);
    expect(last.removedAskIds).toEqual([ask.id]);
  });

  it("only upserts cards that actually changed between deltas", async () => {
    const a = await task("a");
    const askA = await park(a.id, "qa");
    const sub = sink();
    await hub.subscribe(PROJECT, null, sub.send);
    // Park a second ask on a different node; the first card is unchanged.
    const b = await task("b");
    const askB = await park(b.id, "qb");
    await hub.notify(PROJECT);

    const last = deltas(sub.frames).at(-1)!;
    expect(last.upserts.map((i) => i.askId)).toEqual([askB.id]);
    expect(last.upserts.map((i) => i.askId)).not.toContain(askA.id);
  });

  it("resumes from a retained baseline with a forward-only diff", async () => {
    const n = await task("n");
    const a1 = await park(n.id, "first");
    await hub.notify(PROJECT); // seq 2 retained
    const a2 = await park(n.id, "second");
    await hub.notify(PROJECT); // seq 3 retained

    // A client that last saw seq 2 reconnects: it should get only a2, not a1 again.
    const sub = sink();
    await hub.subscribe(PROJECT, 2, sub.send);

    const first = deltas(sub.frames)[0]!;
    expect(first.seq).toBe(3);
    expect(first.upserts.map((i) => i.askId)).toEqual([a2.id]);
    expect(first.upserts.map((i) => i.askId)).not.toContain(a1.id);
  });

  it("tells a client whose lastSeq predates retained history to resync", async () => {
    const n = await task("n");
    // Generate enough notifies to evict early snapshots (retain: 8).
    for (let i = 0; i < 12; i += 1) {
      await park(n.id, `q${i}`);
      await hub.notify(PROJECT);
    }
    const sub = sink();
    await hub.subscribe(PROJECT, 1, sub.send); // seq 1 long evicted

    expect(sub.frames[0]).toMatchObject({ type: "resync" });
  });

  it("sends an up-to-date empty delta when lastSeq equals the current seq", async () => {
    const n = await task("n");
    await park(n.id, "q");
    await hub.notify(PROJECT); // seq 2 current

    const sub = sink();
    await hub.subscribe(PROJECT, 2, sub.send);

    const d = deltas(sub.frames)[0]!;
    expect(d).toMatchObject({ seq: 2, upserts: [], removedAskIds: [] });
  });

  it("fans out to every live subscriber and stops after a subscription closes", async () => {
    const n = await task("n");
    const s1 = sink();
    const s2 = sink();
    await hub.subscribe(PROJECT, null, s1.send);
    const sub2 = await hub.subscribe(PROJECT, null, s2.send);

    await park(n.id, "q1");
    await hub.notify(PROJECT);
    sub2.close();
    await park(n.id, "q2");
    await hub.notify(PROJECT);

    expect(deltas(s1.frames)).toHaveLength(3); // snapshot + 2 deltas
    expect(deltas(s2.frames)).toHaveLength(2); // snapshot + 1 delta, then closed
  });
});
