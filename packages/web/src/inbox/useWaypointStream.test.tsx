// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import type { InboxItem, InboxResponse } from "@waypoint/shared";
import { useWaypointStream, type SocketLike } from "./useWaypointStream.js";

const BASE = "http://waypoint.test";
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const item = (askId: string, over: Partial<InboxItem> = {}): InboxItem => ({
  askId,
  nodeId: `node-${askId}`,
  nodeTitle: `Node ${askId}`,
  type: "QUESTION",
  state: "OPEN",
  prompt: `prompt ${askId}`,
  required: true,
  options: [],
  blastRadius: 0,
  parkedAt: 1000,
  askVersion: 1,
  nodeVersion: 1,
  ...over,
});

// Deterministic stand-in for a WebSocket the test drives by hand.
class FakeSocket implements SocketLike {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readonly sent: string[] = [];
  private closed = false;
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.onclose?.();
  }
  open(): void {
    this.onopen?.();
  }
  emit(frame: unknown): void {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
  lastResume(): { type: string; projectId: string; lastSeq: number | null } | undefined {
    const raw = [...this.sent]
      .reverse()
      .find((s) => (JSON.parse(s) as { type: string }).type === "resume");
    return raw ? JSON.parse(raw) : undefined;
  }
}

function harness() {
  const sockets: FakeSocket[] = [];
  return {
    sockets,
    factory: (): SocketLike => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
  };
}

const inboxHandler = (response: InboxResponse | number) =>
  http.get(`${BASE}/v1/projects/:p/inbox`, () =>
    typeof response === "number"
      ? new HttpResponse(null, { status: response })
      : HttpResponse.json(response),
  );

const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

function mount(h: ReturnType<typeof harness>) {
  return renderHook(() =>
    useWaypointStream("default", {
      baseUrl: BASE,
      wsUrl: "ws://test/stream",
      socketFactory: h.factory,
      reconnectDelayMs: 1,
    }),
  );
}

describe("useWaypointStream", () => {
  it("opens and resumes from null when there is nothing applied yet", async () => {
    server.use(inboxHandler(404)); // no REST snapshot — seq stays unset
    const h = harness();
    const { result } = mount(h);
    await flush();
    await act(async () => h.sockets[0]!.open());

    expect(h.sockets[0]!.lastResume()).toEqual({
      type: "resume",
      projectId: "default",
      lastSeq: null,
    });
    expect(result.current.status).toBe("open");
  });

  it("paints from the REST snapshot before the socket delivers anything", async () => {
    server.use(inboxHandler({ projectId: "default", seq: 2, items: [item("a")] }));
    const h = harness();
    const { result } = mount(h);
    await flush();
    expect(result.current.items.map((i) => i.askId)).toEqual(["a"]);
    expect(result.current.seq).toBe(2);
  });

  it("applies live deltas and re-ranks", async () => {
    server.use(inboxHandler(404));
    const h = harness();
    const { result } = mount(h);
    await flush();
    await act(async () => h.sockets[0]!.open());

    await act(async () =>
      h.sockets[0]!.emit({
        type: "delta",
        seq: 3,
        upserts: [item("low", { blastRadius: 0 }), item("high", { blastRadius: 9 })],
        removedAskIds: [],
      }),
    );
    expect(result.current.items.map((i) => i.askId)).toEqual(["high", "low"]);

    await act(async () =>
      h.sockets[0]!.emit({ type: "delta", seq: 4, upserts: [], removedAskIds: ["high"] }),
    );
    expect(result.current.items.map((i) => i.askId)).toEqual(["low"]);
  });

  it("resumes from the last applied seq after the connection drops", async () => {
    server.use(inboxHandler(404));
    const h = harness();
    mount(h);
    await flush();
    await act(async () => h.sockets[0]!.open());
    await act(async () =>
      h.sockets[0]!.emit({ type: "delta", seq: 5, upserts: [item("a")], removedAskIds: [] }),
    );

    await act(async () => h.sockets[0]!.close()); // the socket drops
    await flush(); // reconnect timer fires → a new socket
    expect(h.sockets).toHaveLength(2);
    await act(async () => h.sockets[1]!.open());
    expect(h.sockets[1]!.lastResume()?.lastSeq).toBe(5);
  });

  it("clears state and reconnects from null on a resync", async () => {
    server.use(inboxHandler(404));
    const h = harness();
    const { result } = mount(h);
    await flush();
    await act(async () => h.sockets[0]!.open());
    await act(async () =>
      h.sockets[0]!.emit({ type: "delta", seq: 2, upserts: [item("a")], removedAskIds: [] }),
    );
    expect(result.current.items).toHaveLength(1);

    await act(async () => h.sockets[0]!.emit({ type: "resync", reason: "gap" }));
    expect(result.current.items).toHaveLength(0); // local state cleared

    await flush(); // reconnect
    await act(async () => h.sockets[1]!.open());
    expect(h.sockets[1]!.lastResume()?.lastSeq).toBeNull();
  });
});
