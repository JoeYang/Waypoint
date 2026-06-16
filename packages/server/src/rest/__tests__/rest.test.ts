import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { createCore, type Core } from "@waypoint/core";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "@waypoint/core/testing";
import { createRestServer } from "../server.js";

const PROJECT = "default";

describe("Inbox REST API", () => {
  let backend: InMemoryBackend;
  let clock: FakeClock;
  let core: Core;
  let app: FastifyInstance;

  beforeEach(async () => {
    backend = new InMemoryBackend();
    backend.seedProject({ id: PROJECT, name: "Waypoint", createdAt: 0 });
    clock = new FakeClock(1_000);
    core = createCore({ uow: backend.uow, clock, ids: new FakeIdGenerator("x") });
    app = createRestServer(core);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  const task = (title: string) =>
    core.createNode({ projectId: PROJECT, parentId: null, kind: "task", title });

  const decision = (nodeId: string, prompt: string) =>
    core.parkAsk({
      projectId: PROJECT,
      nodeId,
      type: "DECISION",
      prompt,
      required: true,
      options: ["Postgres", "SQLite"],
    });

  describe("GET /v1/projects/:projectId/inbox", () => {
    it("returns the ranked inbox with a tracing header", async () => {
      const n = await task("node");
      const ask = await decision(n.id, "which db?");

      const res = await app.inject({ method: "GET", url: `/v1/projects/${PROJECT}/inbox` });

      expect(res.statusCode).toBe(200);
      expect(res.headers["x-request-id"]).toBeTruthy();
      const body = res.json();
      expect(body).toMatchObject({ projectId: PROJECT, seq: 2 });
      expect(body.items).toHaveLength(1);
      expect(body.items[0]).toMatchObject({ askId: ask.id, prompt: "which db?", blastRadius: 0 });
    });

    it("404s an unknown project with the error envelope, leaking no internals", async () => {
      const res = await app.inject({ method: "GET", url: "/v1/projects/ghost/inbox" });
      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body).toMatchObject({ error: "NOT_FOUND" });
      expect(body.request_id).toBeTruthy();
      expect(JSON.stringify(body)).not.toMatch(/stack|at Object|\.ts:/i);
    });
  });

  describe("POST /v1/projects/:projectId/asks/:askId/answer", () => {
    it("answers an OPEN decision atomically and reports the node's blocked state", async () => {
      const n = await task("node");
      await core.transition({ projectId: PROJECT, nodeId: n.id, to: "ACTIVE", expectedVersion: 1 });
      const ask = await decision(n.id, "which db?");

      const res = await app.inject({
        method: "POST",
        url: `/v1/projects/${PROJECT}/asks/${ask.id}/answer`,
        payload: { expectedVersion: 1, chosenOptionId: "opt-1" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        askId: ask.id,
        askState: "ANSWERED",
        askVersion: 2,
        nodeId: n.id,
        nodeBlocked: false, // the only blocking ask is now answered
        nodeVersion: 2,
      });
    });

    const proposal = (nodeId: string, prompt: string) =>
      core.parkAsk({
        projectId: PROJECT,
        nodeId,
        type: "PROPOSAL",
        prompt,
        required: true,
        options: [],
      });

    it("answers a PROPOSAL with an adjust verdict and echoes the constraint", async () => {
      const n = await task("node");
      await core.transition({ projectId: PROJECT, nodeId: n.id, to: "ACTIVE", expectedVersion: 1 });
      const ask = await proposal(n.id, "Replace the poller with a webhook?");

      const res = await app.inject({
        method: "POST",
        url: `/v1/projects/${PROJECT}/asks/${ask.id}/answer`,
        payload: {
          expectedVersion: 1,
          proposalVerdict: "adjust",
          adjustmentNote: "keep poller 30d",
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        askId: ask.id,
        askState: "ANSWERED",
        proposalVerdict: "adjust",
        adjustmentNote: "keep poller 30d",
      });
      // The constraint is the immutable record on the ask.
      expect((await backend.asks.findById(PROJECT, ask.id))?.answerText).toBe("keep poller 30d");
    });

    it("answers a PROPOSAL with an approve verdict", async () => {
      const n = await task("node");
      const ask = await proposal(n.id, "Replace the poller with a webhook?");

      const res = await app.inject({
        method: "POST",
        url: `/v1/projects/${PROJECT}/asks/${ask.id}/answer`,
        payload: { expectedVersion: 1, proposalVerdict: "approve" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ askId: ask.id, askState: "ANSWERED" });
    });

    it("400s an adjust verdict with no constraint note", async () => {
      const n = await task("node");
      const ask = await proposal(n.id, "Replace the poller with a webhook?");

      const res = await app.inject({
        method: "POST",
        url: `/v1/projects/${PROJECT}/asks/${ask.id}/answer`,
        payload: { expectedVersion: 1, proposalVerdict: "adjust" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: "VALIDATION" });
    });

    it("409s a stale expected_version without overwriting", async () => {
      const n = await task("node");
      const ask = await decision(n.id, "which db?");

      const res = await app.inject({
        method: "POST",
        url: `/v1/projects/${PROJECT}/asks/${ask.id}/answer`,
        payload: { expectedVersion: 99, chosenOptionId: "opt-1" },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ error: "STALE_VERSION" });
      // The ask is untouched — still OPEN at version 1.
      const fresh = await app.inject({ method: "GET", url: `/v1/projects/${PROJECT}/inbox` });
      expect(fresh.json().items[0]).toMatchObject({ askId: ask.id, state: "OPEN", askVersion: 1 });
    });

    it("400s a malformed body (missing expectedVersion)", async () => {
      const n = await task("node");
      const ask = await decision(n.id, "which db?");

      const res = await app.inject({
        method: "POST",
        url: `/v1/projects/${PROJECT}/asks/${ask.id}/answer`,
        payload: { chosenOptionId: "opt-1" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: "VALIDATION" });
    });

    it("400s when a decision answer chooses an option that is not on the ask", async () => {
      const n = await task("node");
      const ask = await decision(n.id, "which db?");

      const res = await app.inject({
        method: "POST",
        url: `/v1/projects/${PROJECT}/asks/${ask.id}/answer`,
        payload: { expectedVersion: 1, chosenOptionId: "opt-9" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: "VALIDATION" });
    });

    it("400s a syntactically malformed JSON body without leaking internals", async () => {
      // Broken JSON fails in fastify's body parser before our schema runs — it reaches the
      // error handler as a raw 4xx, exercising the generic fallback branch. The response
      // must still use the error envelope and reveal no parser/stack detail.
      const res = await app.inject({
        method: "POST",
        url: `/v1/projects/${PROJECT}/asks/whatever/answer`,
        headers: { "content-type": "application/json" },
        payload: "{ not: valid json ",
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: "VALIDATION", message: "invalid request" });
      expect(res.headers["x-request-id"]).toBeTruthy();
      expect(JSON.stringify(res.json())).not.toMatch(/json|parse|syntax|stack/i);
    });

    it("404s answering an ask that does not exist", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/v1/projects/${PROJECT}/asks/ghost/answer`,
        payload: { expectedVersion: 1, answerText: "x" },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ error: "NOT_FOUND" });
    });
  });

  describe("GET /v1/projects/:projectId/progress", () => {
    it("returns the goal→plan→task spine with a tracing header", async () => {
      const goal = await core.createNode({
        projectId: PROJECT,
        parentId: null,
        kind: "goal",
        title: "Ship checkout",
      });
      const plan = await core.createNode({
        projectId: PROJECT,
        parentId: goal.id,
        kind: "plan",
        title: "Refunds",
      });
      const t = await core.createNode({
        projectId: PROJECT,
        parentId: plan.id,
        kind: "task",
        title: "cache",
      });
      await core.parkAsk({
        projectId: PROJECT,
        nodeId: t.id,
        type: "DECISION",
        prompt: "which cache?",
        required: true,
        options: ["redis", "pg"],
      });

      const res = await app.inject({ method: "GET", url: `/v1/projects/${PROJECT}/progress` });

      expect(res.statusCode).toBe(200);
      expect(res.headers["x-request-id"]).toBeTruthy();
      const body = res.json();
      expect(body).toMatchObject({ projectId: PROJECT });
      expect(body.goals[0]).toMatchObject({ title: "Ship checkout", state: "blocked" });
      expect(body.goals[0].plans[0].tasks[0]).toMatchObject({
        nodeId: t.id,
        state: "blocked-on-ask",
      });
    });

    it("404s an unknown project with the error envelope, leaking no internals", async () => {
      const res = await app.inject({ method: "GET", url: "/v1/projects/ghost/progress" });
      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body).toMatchObject({ error: "NOT_FOUND" });
      expect(body.request_id).toBeTruthy();
      expect(JSON.stringify(body)).not.toMatch(/stack|at Object|\.ts:/i);
    });
  });
});
