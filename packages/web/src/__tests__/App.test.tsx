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

describe("App shell", () => {
  it("renders the Axiom-styled inbox chrome around the live inbox", async () => {
    render(
      <App baseUrl={BASE} streamOptions={{ socketFactory: noopSocket, wsUrl: "ws://test" }} />,
    );
    expect(screen.getByText("Waypoint")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /decision inbox/i })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    await flush(); // let the empty snapshot settle
    expect(screen.getByText(/nothing waiting/i)).toBeInTheDocument();
  });
});
