import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import WebSocket, { type WebSocketServer } from "ws";
import { createCore, type Core } from "@waypoint/core";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "@waypoint/core/testing";
import { InboxHub } from "../hub.js";
import { createNotifyingCore } from "../notifying-core.js";
import { createInboxWsServer } from "../server.js";

const PROJECT = "default";

// Drains a ws into an async queue so tests can await frames one at a time.
function frames(ws: WebSocket) {
  const buffered: Record<string, unknown>[] = [];
  const waiters: ((v: Record<string, unknown>) => void)[] = [];
  ws.on("message", (raw: Buffer) => {
    const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
    const waiter = waiters.shift();
    if (waiter) waiter(msg);
    else buffered.push(msg);
  });
  return {
    next: (): Promise<Record<string, unknown>> => {
      const ready = buffered.shift();
      if (ready) return Promise.resolve(ready);
      return new Promise((resolve) => waiters.push(resolve));
    },
  };
}

describe("Inbox WebSocket server — failure injection", () => {
  let backend: InMemoryBackend;
  let core: Core;
  let notifying: Core;
  let hub: InboxHub;
  let http: Server;
  let wss: WebSocketServer;
  let url: string;
  const open: WebSocket[] = [];

  beforeEach(async () => {
    backend = new InMemoryBackend();
    backend.seedProject({ id: PROJECT, name: "Waypoint", createdAt: 0 });
    core = createCore({
      uow: backend.uow,
      clock: new FakeClock(1_000),
      ids: new FakeIdGenerator("x"),
    });
    hub = new InboxHub(core, { retain: 32 });
    notifying = createNotifyingCore(core, hub);
    http = createServer();
    wss = createInboxWsServer(hub, http, { heartbeatMs: 0 });
    await new Promise<void>((resolve) => http.listen(0, resolve));
    const { port } = http.address() as AddressInfo;
    url = `ws://127.0.0.1:${port}/v1/projects/${PROJECT}/stream`;
  });

  afterEach(async () => {
    for (const ws of open.splice(0)) ws.close();
    wss.close();
    await new Promise<void>((resolve) => http.close(() => resolve()));
  });

  const connect = async (): Promise<WebSocket> => {
    const ws = new WebSocket(url);
    open.push(ws);
    await once(ws, "open");
    return ws;
  };

  const park = async (title: string): Promise<{ nodeId: string; askId: string }> => {
    const node = await notifying.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title,
    });
    const ask = await notifying.parkAsk({
      projectId: PROJECT,
      nodeId: node.id,
      type: "QUESTION",
      prompt: `q-${title}`,
      required: true,
      options: [],
    });
    return { nodeId: node.id, askId: ask.id };
  };

  it("streams the initial snapshot then live deltas as mutations commit", async () => {
    const ws = await connect();
    const q = frames(ws);
    ws.send(JSON.stringify({ type: "resume", projectId: PROJECT, lastSeq: null }));

    expect(await q.next()).toMatchObject({ type: "delta", seq: 0, upserts: [] }); // snapshot

    const { askId } = await park("a"); // createNode (seq1) + parkAsk (seq2)
    // createNode emits an empty delta (inbox unchanged); parkAsk adds the card.
    let msg = await q.next();
    if ((msg.upserts as unknown[]).length === 0) msg = await q.next();
    expect(msg).toMatchObject({ type: "delta" });
    expect((msg.upserts as { askId: string }[]).map((i) => i.askId)).toEqual([askId]);
  });

  it("closes on a malformed frame without affecting other connections", async () => {
    const bad = await connect();
    bad.send("this is not json");
    const [code] = (await once(bad, "close")) as [number];
    expect(code).toBe(1008);

    // A fresh connection still works — the server did not crash.
    const good = await connect();
    const q = frames(good);
    good.send(JSON.stringify({ type: "resume", projectId: PROJECT, lastSeq: null }));
    expect(await q.next()).toMatchObject({ type: "delta" });
  });

  it("rejects a frame whose projectId does not match the connection scope", async () => {
    const ws = await connect();
    ws.send(JSON.stringify({ type: "resume", projectId: "other", lastSeq: null }));
    const [code] = (await once(ws, "close")) as [number];
    expect(code).toBe(1008);
  });

  it("resumes after a dropped connection with no missed or duplicated deltas", async () => {
    const ws1 = await connect();
    const q1 = frames(ws1);
    ws1.send(JSON.stringify({ type: "resume", projectId: PROJECT, lastSeq: null }));
    await q1.next(); // snapshot seq 0

    const { askId } = await park("a"); // seq 1 (node), seq 2 (ask) — card now visible
    // Drain until we have seen seq 2.
    let last: Record<string, unknown> = await q1.next();
    while (last.seq !== 2) last = await q1.next();

    // Connection drops while the human answers the ask (seq 3 — card removed).
    ws1.close();
    await once(ws1, "close");
    await notifying.answer({ projectId: PROJECT, askId, expectedVersion: 1, answerText: "yes" });

    // Reconnect resuming from the last seq we saw (2): we must get exactly the removal.
    const ws2 = await connect();
    const q2 = frames(ws2);
    ws2.send(JSON.stringify({ type: "resume", projectId: PROJECT, lastSeq: 2 }));

    const resumed = await q2.next();
    expect(resumed).toMatchObject({ type: "delta", seq: 3, upserts: [], removedAskIds: [askId] });
  });
});
