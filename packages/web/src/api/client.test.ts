import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import type { InboxResponse, AnswerResponse } from "@waypoint/shared";
import {
  fetchInbox,
  fetchProjects,
  fetchEvents,
  answerAsk,
  fetchDigest,
  ackDigest,
  fetchStory,
  ApiError,
} from "./client.js";

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

  it("fetches and validates the project list", async () => {
    server.use(
      http.get(`${BASE}/v1/projects`, () =>
        HttpResponse.json({
          projects: [{ id: "orbit-api", name: "orbit-api", openAskCount: 3, agentTaskCount: 6 }],
        }),
      ),
    );
    const result = await fetchProjects(BASE);
    expect(result.projects[0]).toMatchObject({ id: "orbit-api", openAskCount: 3 });
  });

  it("fetches the event log and passes sinceSeq through", async () => {
    let url = "";
    server.use(
      http.get(`${BASE}/v1/projects/default/events`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ projectId: "default", seq: 4, events: [] });
      }),
    );
    const result = await fetchEvents(BASE, "default", 2);
    expect(result).toMatchObject({ projectId: "default", seq: 4 });
    expect(url).toContain("sinceSeq=2");
  });

  it("fetches and validates the while-you-were-away digest", async () => {
    server.use(
      http.get(`${BASE}/v1/projects/default/digest`, () =>
        HttpResponse.json({
          projectId: "default",
          sinceSeq: 3,
          seq: 7,
          shipped: [{ nodeId: "n1", kind: "task", title: "Wire the spine" }],
          newlyBlocked: [],
          waiting: [
            {
              askId: "a1",
              nodeId: "n2",
              nodeTitle: "Pick a DB",
              type: "DECISION",
              prompt: "Postgres?",
              blastRadius: 3,
              ageMs: 7200000,
              risk: "medium",
              reversible: true,
              isNew: true,
            },
          ],
          activeWork: [
            {
              nodeId: "n3",
              nodeTitle: "Seed scripts",
              kind: "task",
              streamId: "n0",
              streamTitle: "Data",
            },
          ],
          headsUp: [],
          tallies: { done: 1, active: 1, parked: 0, queued: 2 },
        }),
      ),
    );
    const d = await fetchDigest(BASE, "default");
    expect(d.shipped[0]?.title).toBe("Wire the spine");
    expect(d.waiting[0]?.blastRadius).toBe(3);
    expect(d.waiting[0]?.isNew).toBe(true);
    expect(d.activeWork[0]?.streamTitle).toBe("Data");
    expect(d.tallies.queued).toBe(2);
  });

  it("posts a digest ack and returns the new cursor", async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE}/v1/projects/default/digest/ack`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ projectId: "default", lastSeenSeq: 7 });
      }),
    );
    const res = await ackDigest(BASE, "default", 7);
    expect(res.lastSeenSeq).toBe(7);
    expect(body).toMatchObject({ seq: 7 });
  });

  it("fetches and validates the threaded story", async () => {
    server.use(
      http.get(`${BASE}/v1/projects/default/story`, () =>
        HttpResponse.json({
          projectId: "default",
          seq: 2,
          entries: [
            {
              seq: 1,
              at: 1700000000000,
              actor: "agent",
              actorLabel: "brave-lark",
              verb: "node.created",
              nodeId: "n1",
              nodeTitle: "A",
              summary: "created task: A",
            },
          ],
        }),
      ),
    );
    const story = await fetchStory(BASE, "default");
    expect(story.entries[0]?.actorLabel).toBe("brave-lark");
  });

  it("surfaces an unknown project as a typed ApiError on the digest route", async () => {
    server.use(
      http.get(`${BASE}/v1/projects/ghost/digest`, () =>
        HttpResponse.json(
          { error: "NOT_FOUND", message: "project not found", request_id: "r" },
          { status: 404 },
        ),
      ),
    );
    await expect(fetchDigest(BASE, "ghost")).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
    await expect(fetchDigest(BASE, "ghost")).rejects.toBeInstanceOf(ApiError);
  });
});
