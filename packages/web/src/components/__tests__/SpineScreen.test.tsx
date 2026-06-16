// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import type { ProjectProgress } from "@waypoint/shared";
import { SpineScreen } from "../SpineScreen.js";
import type { SocketLike } from "../../inbox/useWaypointStream.js";

const BASE = "http://waypoint.test";
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());

class FakeSocket implements SocketLike {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send(): void {}
  close(): void {
    this.onclose?.();
  }
  open(): void {
    this.onopen?.();
  }
  emit(frame: unknown): void {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
}

function harness() {
  const sockets: FakeSocket[] = [];
  return {
    sockets,
    factory: (): SocketLike => {
      const s = new FakeSocket();
      sockets.push(s);
      return s;
    },
  };
}

const ask = {
  askId: "ask-1",
  nodeId: "t-cache",
  nodeTitle: "cache",
  type: "DECISION" as const,
  state: "OPEN" as const,
  prompt: "Redis or Postgres?",
  required: true,
  options: [
    { id: "opt-1", label: "Redis" },
    { id: "opt-2", label: "Postgres" },
  ],
  blastRadius: 1,
  parkedAt: 1000,
  askVersion: 1,
  nodeVersion: 1,
};

const spine = (withAsk: boolean): ProjectProgress => ({
  projectId: "default",
  seq: 5,
  goals: [
    {
      nodeId: "g1",
      title: "Ship checkout",
      state: withAsk ? "blocked" : "on-track",
      plansDone: 0,
      plansTotal: 1,
      openAskCount: withAsk ? 1 : 0,
      blastRadius: 0,
      plans: [
        {
          nodeId: "p1",
          title: "Refunds",
          state: withAsk ? "blocked" : "active",
          agentLabel: "checkout-agent",
          lastActivityAt: 1000,
          openAskCount: withAsk ? 1 : 0,
          blastRadius: 0,
          tasks: [
            {
              nodeId: "t-cache",
              title: "cache",
              state: withAsk ? "blocked-on-ask" : "running",
              agentLabel: "checkout-agent",
              blastRadius: 1,
              group: null,
              asks: withAsk ? [ask] : [],
            },
          ],
        },
      ],
    },
  ],
});

const emptyInbox = http.get(`${BASE}/v1/projects/:p/inbox`, () =>
  HttpResponse.json({ projectId: "default", seq: 5, items: [] }),
);

const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

function mount(h: ReturnType<typeof harness>) {
  return render(
    <SpineScreen
      projectId="default"
      baseUrl={BASE}
      streamOptions={{ socketFactory: h.factory, wsUrl: "ws://test", reconnectDelayMs: 1 }}
    />,
  );
}

describe("SpineScreen", () => {
  it("shows a loading state before the spine lands", async () => {
    server.use(
      emptyInbox,
      http.get(`${BASE}/v1/projects/:p/progress`, () => new HttpResponse(null, { status: 404 })),
    );
    mount(harness());
    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
    await flush();
  });

  it("shows an error with retry when the spine can't be loaded", async () => {
    server.use(
      emptyInbox,
      http.get(`${BASE}/v1/projects/:p/progress`, () => new HttpResponse(null, { status: 404 })),
    );
    const h = harness();
    mount(h);
    await flush();
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't load/i);
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    await flush();
  });

  it("renders the spine once it paints", async () => {
    server.use(
      emptyInbox,
      http.get(`${BASE}/v1/projects/:p/progress`, () => HttpResponse.json(spine(true))),
    );
    mount(harness());
    await flush();
    expect(screen.getByRole("heading", { name: /Ship checkout/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Redis or Postgres?" })).toBeInTheDocument();
  });

  it("answers a card and refetches the spine on the live WS signal, dropping the answered ask", async () => {
    let posted: unknown;
    let withAsk = true;
    server.use(
      emptyInbox,
      http.get(`${BASE}/v1/projects/:p/progress`, () => HttpResponse.json(spine(withAsk))),
      http.post(`${BASE}/v1/projects/default/asks/ask-1/answer`, async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({
          askId: "ask-1",
          askState: "ANSWERED",
          askVersion: 2,
          nodeId: "t-cache",
          nodeBlocked: false,
          nodeVersion: 1,
        });
      }),
    );
    const h = harness();
    mount(h);
    await flush();
    await act(async () => h.sockets[0]!.open());

    await userEvent.click(screen.getByRole("button", { name: "Postgres" }));
    expect(posted).toEqual({ expectedVersion: 1, chosenOptionId: "opt-2" });

    // The next /progress no longer carries the ask; the live delta (seq advance) refetches it.
    withAsk = false;
    await act(async () =>
      h.sockets[0]!.emit({ type: "delta", seq: 6, upserts: [], removedAskIds: ["ask-1"] }),
    );
    await flush();
    expect(screen.queryByRole("heading", { name: "Redis or Postgres?" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Ship checkout/ })).toBeInTheDocument();
  });
});
