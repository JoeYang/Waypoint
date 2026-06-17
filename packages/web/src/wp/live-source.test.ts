import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { createLiveSource } from "./live-source.js";

const BASE = "http://waypoint.test";
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

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
    );

    const data = await createLiveSource(BASE).load();
    expect(data.projects).toHaveLength(1);
    const p = data.projects[0]!;
    expect(p).toMatchObject({ id: "orbit-api", agent: "working", agentTasks: 2 });
    expect(p.streams[0]).toMatchObject({ name: "Data layer", status: "blocked" });
    expect(p.decisions[0]).toMatchObject({ id: "d1", risk: "high", reversible: false, version: 2 });
    expect(p.decisions[0]?.options[0]).toMatchObject({ id: "opt-1", name: "Drizzle" });
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
});
