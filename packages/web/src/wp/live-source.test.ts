import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { createLiveSource } from "./live-source.js";

const BASE = "http://waypoint.test";
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// A minimal fake WebSocket so subscribe() can be exercised without a real socket.
type WsHandler = (e: { data: string }) => void;
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  handlers: Record<string, WsHandler[]> = {};
  sent: string[] = [];
  closed = false;
  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }
  addEventListener(type: string, h: WsHandler): void {
    (this.handlers[type] ??= []).push(h);
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.closed = true;
  }
  emit(type: string, e: { data: string }): void {
    (this.handlers[type] ?? []).forEach((h) => h(e));
  }
}

const progress = {
  projectId: "orbit-api",
  seq: 5,
  goals: [
    {
      nodeId: "g1",
      title: "Ship",
      state: "at-risk",
      plansDone: 0,
      plansTotal: 1,
      openAskCount: 1,
      blastRadius: 0,
      plans: [
        {
          nodeId: "plan-data",
          title: "Data layer",
          state: "blocked",
          agentLabel: "agent",
          lastActivityAt: 1,
          openAskCount: 1,
          blastRadius: 0,
          tasks: [
            {
              nodeId: "t1",
              title: "Choose ORM",
              state: "blocked-on-ask",
              agentLabel: null,
              blastRadius: 0,
              group: null,
              prUrl: null,
              asks: [],
            },
          ],
        },
      ],
    },
  ],
};

const inbox = {
  projectId: "orbit-api",
  seq: 5,
  items: [
    {
      askId: "d1",
      nodeId: "t1",
      nodeTitle: "Choose ORM",
      type: "DECISION",
      state: "OPEN",
      prompt: "Which ORM?",
      required: true,
      options: [{ id: "opt-1", label: "Drizzle" }],
      blastRadius: 1,
      parkedAt: 0,
      askVersion: 2,
      nodeVersion: 1,
      risk: "high",
      reversible: false,
    },
  ],
};

describe("liveSource", () => {
  it("load composes the project list, progress, and inbox into the view-model", async () => {
    server.use(
      http.get(`${BASE}/v1/projects`, () =>
        HttpResponse.json({
          projects: [{ id: "orbit-api", name: "orbit-api", openAskCount: 1, agentTaskCount: 2 }],
        }),
      ),
      http.get(`${BASE}/v1/projects/orbit-api/progress`, () => HttpResponse.json(progress)),
      http.get(`${BASE}/v1/projects/orbit-api/inbox`, () => HttpResponse.json(inbox)),
      http.get(`${BASE}/v1/projects/orbit-api/events`, () =>
        HttpResponse.json({
          projectId: "orbit-api",
          seq: 5,
          events: [
            {
              id: "e1",
              projectId: "orbit-api",
              seq: 5,
              actor: "agent",
              verb: "ask.parked",
              ref: { kind: "ask", id: "d1" },
              sessionId: null,
              summary: "parked a decision",
              at: 1,
            },
          ],
        }),
      ),
    );

    const data = await createLiveSource(BASE).load();
    expect(data.projects).toHaveLength(1);
    const p = data.projects[0]!;
    expect(p).toMatchObject({ id: "orbit-api", agent: "working", agentTasks: 2 });
    expect(p.streams[0]).toMatchObject({ name: "Data layer", status: "blocked" });
    expect(p.decisions[0]).toMatchObject({ id: "d1", risk: "high", reversible: false, version: 2 });
    expect(p.decisions[0]?.options[0]).toMatchObject({ id: "opt-1", name: "Drizzle" });
    expect(p.activity[0]?.items[0]).toMatchObject({ kind: "parked" });
    expect(data.notifications).toHaveLength(1); // derived from the open decision
  });

  it("answer POSTs with the expected version and chosen option id", async () => {
    let received: unknown;
    server.use(
      http.post(`${BASE}/v1/projects/orbit-api/asks/d1/answer`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({
          askId: "d1",
          askState: "ANSWERED",
          askVersion: 3,
          nodeId: "t1",
          nodeBlocked: false,
          nodeVersion: 2,
        });
      }),
    );

    await createLiveSource(BASE).answer({
      projectId: "orbit-api",
      decisionId: "d1",
      chosenOptionId: "opt-1",
      expectedVersion: 2,
    });
    expect(received).toEqual({ expectedVersion: 2, chosenOptionId: "opt-1" });
  });

  it("subscribe opens a per-project WS and reloads on a delta frame", async () => {
    FakeWebSocket.instances = [];
    const realWs = globalThis.WebSocket;
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
    server.use(
      http.get(`${BASE}/v1/projects`, () =>
        HttpResponse.json({
          projects: [{ id: "orbit-api", name: "orbit-api", openAskCount: 0, agentTaskCount: 0 }],
        }),
      ),
    );
    try {
      let changes = 0;
      const unsubscribe = createLiveSource(BASE).subscribe(() => {
        changes += 1;
      });
      await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
      const ws = FakeWebSocket.instances[0]!;
      expect(ws.url).toBe("ws://waypoint.test/v1/projects/orbit-api/stream");
      ws.emit("open", { data: "" });
      expect(ws.sent[0]).toContain('"type":"resume"');

      ws.emit("message", { data: JSON.stringify({ type: "resync", reason: "gap" }) });
      expect(changes).toBe(1);
      ws.emit("message", { data: JSON.stringify({ type: "delta", seq: 1 }) });
      expect(changes).toBe(2);
      // A tiered notification escalating also refreshes (the digest is derived from the reload).
      ws.emit("message", {
        data: JSON.stringify({
          type: "digest.ready",
          seq: 2,
          reason: "threshold",
          askId: "a1",
          summary: "1 waiting",
        }),
      });
      expect(changes).toBe(3);

      unsubscribe();
      expect(ws.closed).toBe(true);
    } finally {
      globalThis.WebSocket = realWs;
    }
  });
});
