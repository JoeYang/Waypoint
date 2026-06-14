// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import type { InboxItem, InboxResponse } from "@waypoint/shared";
import { InboxScreen } from "../InboxScreen.js";
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
  fail(): void {
    this.onerror?.();
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

const decision = (askId: string, blastRadius: number): InboxItem => ({
  askId,
  nodeId: `node-${askId}`,
  nodeTitle: `Node ${askId}`,
  type: "DECISION",
  state: "OPEN",
  prompt: `Decide ${askId}?`,
  required: true,
  options: [{ id: "opt-1", label: `Ship ${askId}` }],
  blastRadius,
  parkedAt: 1000,
  askVersion: 1,
  nodeVersion: 1,
});

const inbox = (response: InboxResponse | number) =>
  http.get(`${BASE}/v1/projects/:p/inbox`, () =>
    typeof response === "number"
      ? new HttpResponse(null, { status: response })
      : HttpResponse.json(response),
  );

const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

function mount(h: ReturnType<typeof harness>) {
  return render(
    <InboxScreen
      projectId="default"
      baseUrl={BASE}
      streamOptions={{ socketFactory: h.factory, wsUrl: "ws://test", reconnectDelayMs: 1 }}
    />,
  );
}

describe("InboxScreen", () => {
  it("shows a loading state before the first snapshot lands", async () => {
    server.use(inbox(404)); // REST gives nothing; socket left unopened
    mount(harness());
    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
    await flush();
  });

  it("shows an error with a retry action when the inbox can't be reached", async () => {
    server.use(inbox(404));
    const h = harness();
    mount(h);
    await flush();
    await act(async () => h.sockets[0]!.fail()); // socket error, still nothing loaded

    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't reach/i);
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    await flush();
    expect(h.sockets.length).toBeGreaterThan(1); // reconnect attempted
  });

  it("renders the inbox ranked once the snapshot paints", async () => {
    server.use(
      inbox({ projectId: "default", seq: 3, items: [decision("a", 1), decision("b", 9)] }),
    );
    mount(harness());
    await flush();
    const headings = screen.getAllByRole("heading").map((h) => h.textContent);
    expect(headings).toEqual(["Decide b?", "Decide a?"]); // b blocks more → first
  });

  it("flips an answered card to working, then the WS delta removes it and the queue re-ranks", async () => {
    let posted: unknown;
    server.use(
      inbox({ projectId: "default", seq: 3, items: [decision("a", 9), decision("b", 1)] }),
      http.post(`${BASE}/v1/projects/default/asks/a/answer`, async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({
          askId: "a",
          askState: "ANSWERED",
          askVersion: 2,
          nodeId: "node-a",
          nodeBlocked: false,
          nodeVersion: 1,
        });
      }),
    );
    const h = harness();
    mount(h);
    await flush();
    await act(async () => h.sockets[0]!.open());

    // Answer the top card.
    await userEvent.click(screen.getByRole("button", { name: "Ship a" }));
    expect(posted).toEqual({ expectedVersion: 1, chosenOptionId: "opt-1" });
    expect(screen.getByText(/working/i)).toBeInTheDocument();

    // The server's delta removes it; the queue re-ranks to b.
    await act(async () =>
      h.sockets[0]!.emit({ type: "delta", seq: 4, upserts: [], removedAskIds: ["a"] }),
    );
    expect(screen.queryByRole("heading", { name: "Decide a?" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Decide b?" })).toBeInTheDocument();
  });

  it("clears working and surfaces an error when the answer is rejected", async () => {
    server.use(
      inbox({ projectId: "default", seq: 2, items: [decision("a", 1)] }),
      http.post(`${BASE}/v1/projects/default/asks/a/answer`, () =>
        HttpResponse.json(
          { error: "STALE_VERSION", message: "stale", request_id: "r" },
          { status: 409 },
        ),
      ),
    );
    const h = harness();
    mount(h);
    await flush();
    await act(async () => h.sockets[0]!.open());

    await userEvent.click(screen.getByRole("button", { name: "Ship a" }));
    await flush();

    expect(screen.getByRole("alert")).toBeInTheDocument();
    // The control is back (no longer working) so the human can retry.
    expect(screen.getByRole("button", { name: "Ship a" })).toBeInTheDocument();
  });
});
