import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import type { InboxResponse, AnswerResponse } from "@waypoint/shared";
import { fetchInbox, answerAsk, ApiError } from "./client.js";

const BASE = "http://waypoint.test";
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const inbox: InboxResponse = {
  projectId: "default",
  seq: 4,
  items: [
    {
      askId: "ask-1",
      nodeId: "node-1",
      nodeTitle: "N",
      type: "DECISION",
      state: "OPEN",
      prompt: "Which?",
      required: true,
      options: [
        { id: "opt-1", label: "A" },
        { id: "opt-2", label: "B" },
      ],
      blastRadius: 2,
      parkedAt: 1000,
      askVersion: 1,
      nodeVersion: 1,
      risk: "medium",
      reversible: true,
    },
  ],
};

describe("REST client", () => {
  it("fetches and validates the inbox", async () => {
    server.use(http.get(`${BASE}/v1/projects/default/inbox`, () => HttpResponse.json(inbox)));
    const result = await fetchInbox(BASE, "default");
    expect(result.seq).toBe(4);
    expect(result.items[0]?.askId).toBe("ask-1");
  });

  it("throws a typed ApiError carrying the envelope code on a 404", async () => {
    server.use(
      http.get(`${BASE}/v1/projects/ghost/inbox`, () =>
        HttpResponse.json(
          { error: "NOT_FOUND", message: "project not found: ghost", request_id: "req-1" },
          { status: 404 },
        ),
      ),
    );
    await expect(fetchInbox(BASE, "ghost")).rejects.toMatchObject({
      name: "ApiError",
      code: "NOT_FOUND",
      status: 404,
    });
  });

  it("posts an answer and returns the validated response", async () => {
    let received: unknown;
    const response: AnswerResponse = {
      askId: "ask-1",
      askState: "ANSWERED",
      askVersion: 2,
      nodeId: "node-1",
      nodeBlocked: false,
      nodeVersion: 1,
    };
    server.use(
      http.post(`${BASE}/v1/projects/default/asks/ask-1/answer`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(response);
      }),
    );
    const result = await answerAsk(BASE, "default", "ask-1", {
      expectedVersion: 1,
      chosenOptionId: "opt-1",
    });
    expect(received).toEqual({ expectedVersion: 1, chosenOptionId: "opt-1" });
    expect(result).toMatchObject({ askState: "ANSWERED", nodeBlocked: false });
  });

  it("surfaces a stale answer as an ApiError(STALE_VERSION) on a 409", async () => {
    server.use(
      http.post(`${BASE}/v1/projects/default/asks/ask-1/answer`, () =>
        HttpResponse.json(
          { error: "STALE_VERSION", message: "stale", request_id: "req-2" },
          { status: 409 },
        ),
      ),
    );
    await expect(
      answerAsk(BASE, "default", "ask-1", { expectedVersion: 1, answerText: "x" }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
