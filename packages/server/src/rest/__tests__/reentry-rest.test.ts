import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { createCore, type Core } from "@waypoint/core";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "@waypoint/core/testing";
import { DEFAULT_NOTIFICATION_POLICY } from "@waypoint/shared";
import { createRestServer } from "../server.js";

const PROJECT = "default";

describe("Re-entry REST API (digest / ack / story / policy)", () => {
  let core: Core;
  let app: FastifyInstance;

  beforeEach(async () => {
    const backend = new InMemoryBackend();
    backend.seedProject({ id: PROJECT, name: "Waypoint", createdAt: 0 });
    core = createCore({
      uow: backend.uow,
      clock: new FakeClock(1_000),
      ids: new FakeIdGenerator("x"),
    });
    app = createRestServer(core);
    await app.ready();
  });
  afterEach(async () => {
    await app.close();
  });

  const task = (title: string) =>
    core.createNode({ projectId: PROJECT, parentId: null, kind: "task", title });

  describe("GET /digest", () => {
    it("returns the while-you-were-away buckets since the cursor", async () => {
      const t = await task("ship");
      await core.transition({ projectId: PROJECT, nodeId: t.id, to: "ACTIVE", expectedVersion: 1 });
      await core.transition({ projectId: PROJECT, nodeId: t.id, to: "DONE", expectedVersion: 2 });
      const res = await app.inject({ method: "GET", url: `/v1/projects/${PROJECT}/digest` });
      expect(res.statusCode).toBe(200);
      expect(res.headers["x-request-id"]).toBeTruthy();
      const body = res.json();
      expect(body.shipped.map((n: { nodeId: string }) => n.nodeId)).toContain(t.id);
      expect(body.sinceSeq).toBe(0);
    });

    it("passes the enriched signals (activeWork / headsUp / tallies) through the endpoint", async () => {
      const active = await task("seed");
      await core.transition({
        projectId: PROJECT,
        nodeId: active.id,
        to: "ACTIVE",
        expectedVersion: 1,
      });
      const risky = await task("destructive migration");
      await core.parkAsk({
        projectId: PROJECT,
        nodeId: risky.id,
        type: "QUESTION",
        prompt: "run it?",
        required: true,
        risk: "high",
        reversible: false,
        options: [],
      });
      const body = (
        await app.inject({ method: "GET", url: `/v1/projects/${PROJECT}/digest` })
      ).json();
      expect(body.activeWork.map((w: { nodeId: string }) => w.nodeId)).toContain(active.id);
      expect(body.headsUp.map((h: { nodeId: string }) => h.nodeId)).toContain(risky.id);
      expect(body.headsUp.find((h: { nodeId: string }) => h.nodeId === risky.id).kind).toBe(
        "danger",
      );
      expect(body.tallies).toMatchObject({ active: 1, parked: 1 });
      expect(body.waiting.find((a: { nodeId: string }) => a.nodeId === risky.id).isNew).toBe(true);
    });

    it("404s an unknown project with the error envelope", async () => {
      const res = await app.inject({ method: "GET", url: `/v1/projects/ghost/digest` });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ error: "NOT_FOUND" });
    });
  });

  describe("POST /digest/ack", () => {
    it("advances the cursor and the next digest reflects it", async () => {
      await task("A");
      const seq = (await core.readEvents(PROJECT)).seq;
      const ack = await app.inject({
        method: "POST",
        url: `/v1/projects/${PROJECT}/digest/ack`,
        payload: { seq },
      });
      expect(ack.statusCode).toBe(200);
      expect(ack.json()).toMatchObject({ lastSeenSeq: seq });
      const digest = await app.inject({ method: "GET", url: `/v1/projects/${PROJECT}/digest` });
      expect(digest.json().sinceSeq).toBe(seq);
    });

    it("400s a malformed ack body", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/v1/projects/${PROJECT}/digest/ack`,
        payload: { seq: -1 },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: "VALIDATION" });
    });
  });

  describe("GET /story", () => {
    it("returns the threaded narrative oldest-first", async () => {
      const a = await task("A");
      await task("B");
      const res = await app.inject({ method: "GET", url: `/v1/projects/${PROJECT}/story` });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.entries[0].nodeId).toBe(a.id);
      expect(body.entries.map((e: { seq: number }) => e.seq)).toEqual([1, 2]);
    });

    it("400s a malformed sinceSeq", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/v1/projects/${PROJECT}/story?sinceSeq=nope`,
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET/PUT /notification-policy", () => {
    it("returns the default policy when none is set", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/v1/projects/${PROJECT}/notification-policy`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(DEFAULT_NOTIFICATION_POLICY);
    });

    it("upserts a policy via PUT and reads it back", async () => {
      const policy = { blastRadiusThreshold: 2, ageSlaSeconds: 120, digestCadenceSeconds: 3600 };
      const put = await app.inject({
        method: "PUT",
        url: `/v1/projects/${PROJECT}/notification-policy`,
        payload: policy,
      });
      expect(put.statusCode).toBe(200);
      const get = await app.inject({
        method: "GET",
        url: `/v1/projects/${PROJECT}/notification-policy`,
      });
      expect(get.json()).toEqual(policy);
    });

    it("400s an invalid policy (non-positive threshold)", async () => {
      const res = await app.inject({
        method: "PUT",
        url: `/v1/projects/${PROJECT}/notification-policy`,
        payload: { blastRadiusThreshold: 0, ageSlaSeconds: 1, digestCadenceSeconds: 1 },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
