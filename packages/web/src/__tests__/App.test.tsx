// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { App } from "../App.js";
import type { SocketLike } from "../inbox/useWaypointStream.js";

const BASE = "http://waypoint.test";
const server = setupServer(
  http.get(`${BASE}/v1/projects/:p/inbox`, () =>
    HttpResponse.json({ projectId: "default", seq: 0, items: [] }),
  ),
  http.get(`${BASE}/v1/projects/:p/progress`, () =>
    HttpResponse.json({ projectId: "default", seq: 0, goals: [] }),
  ),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());

// A no-op socket so the App test never opens a real connection.
const noopSocket = (): SocketLike => ({
  send() {},
  close() {},
  onopen: null,
  onmessage: null,
  onclose: null,
  onerror: null,
});

const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

const opts = { socketFactory: noopSocket, wsUrl: "ws://test" };

describe("App shell", () => {
  it("renders the project spine as the home by default", async () => {
    render(<App baseUrl={BASE} route="/" streamOptions={opts} />);
    expect(screen.getByText("Waypoint")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^project$/i })).toBeInTheDocument();
    // A link to the inbox lens is offered from the spine.
    expect(screen.getByRole("link", { name: /needs you/i })).toBeInTheDocument();
    await flush();
    expect(screen.getByText(/no goals yet/i)).toBeInTheDocument();
  });

  it("renders the inbox as a lens on the stable /inbox route", async () => {
    render(<App baseUrl={BASE} route="/projects/default/inbox" streamOptions={opts} />);
    expect(screen.getByRole("heading", { name: /^inbox$/i })).toBeInTheDocument();
    // From the lens, a link back to the project spine.
    expect(screen.getByRole("link", { name: /project/i })).toBeInTheDocument();
    await flush();
    expect(screen.getByText(/nothing waiting/i)).toBeInTheDocument();
  });
});
