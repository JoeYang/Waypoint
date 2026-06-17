import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { createCore, type Core } from "@waypoint/core";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "@waypoint/core/testing";
import { createRestServer } from "../server.js";

// The production container serves the built web SPA from the same Fastify server that hosts
// the REST API (decision D7: @fastify/static). These tests pin that behaviour without Docker:
// the API must still win over static, deep links must fall back to index.html, and a health
// probe must exist for the container HEALTHCHECK.
const PROJECT = "default";

describe("REST server: health + static web serving", () => {
  let core: Core;
  let webRoot: string;
  let app: FastifyInstance;

  beforeEach(async () => {
    const backend = new InMemoryBackend();
    backend.seedProject({ id: PROJECT, name: "Waypoint", createdAt: 0 });
    core = createCore({ uow: backend.uow, clock: new FakeClock(1), ids: new FakeIdGenerator("x") });
    // A throwaway "web build": an index.html + one asset, like `vite build` output.
    webRoot = mkdtempSync(join(tmpdir(), "waypoint-web-"));
    mkdirSync(join(webRoot, "assets"), { recursive: true });
    writeFileSync(join(webRoot, "index.html"), "<!doctype html><title>Waypoint</title>");
    writeFileSync(join(webRoot, "assets", "app.js"), "console.log('hi')");
    app = createRestServer(core, { webRoot });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    rmSync(webRoot, { recursive: true, force: true });
  });

  it("serves a /healthz probe with 200 regardless of static config", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok" });
  });

  it("serves index.html at the root from the web build", async () => {
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("Waypoint");
  });

  it("serves built assets", async () => {
    const res = await app.inject({ method: "GET", url: "/assets/app.js" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("console.log");
  });

  it("keeps the REST API winning over static (no shadowing)", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/projects" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("projects");
  });

  it("falls back to index.html for client-side routes (SPA deep link)", async () => {
    const res = await app.inject({ method: "GET", url: "/project/abc/inbox" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("Waypoint");
  });

  it("returns a JSON 404 (not index.html) for unknown API routes", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/does-not-exist" });
    expect(res.statusCode).toBe(404);
    expect(res.headers["content-type"]).toMatch(/json/);
  });

  it("without a webRoot, the API still works and root is a plain 404", async () => {
    const bare = createRestServer(core);
    await bare.ready();
    try {
      expect((await bare.inject({ method: "GET", url: "/healthz" })).statusCode).toBe(200);
      expect((await bare.inject({ method: "GET", url: "/v1/projects" })).statusCode).toBe(200);
      expect((await bare.inject({ method: "GET", url: "/" })).statusCode).toBe(404);
    } finally {
      await bare.close();
    }
  });
});
