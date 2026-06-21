import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import {
  AnswerRequestSchema,
  DigestAckRequestSchema,
  NotificationPolicySchema,
  DEFAULT_PRINCIPAL,
  type AnswerResponse,
  type InboxResponse,
  type ProjectProgress,
  type ProjectListResponse,
  type EventLogResponse,
  type Digest,
  type DigestAckResponse,
  type StoryResponse,
  type NotificationPolicy,
} from "@waypoint/shared";
import { type Core, WaypointError, ValidationError, type ErrorCode } from "@waypoint/core";

// Domain error code → HTTP status. The REST adapter holds no domain logic; it only maps
// typed core errors onto the wire and never leaks stack traces, ids, or SQL (security.md).
const HTTP_STATUS: Record<ErrorCode, number> = {
  NOT_FOUND: 404,
  VALIDATION: 400,
  STALE_VERSION: 409,
  BACKEND_UNAVAILABLE: 503,
};

interface ProjectParams {
  projectId: string;
}
interface EventsQuery {
  sinceSeq?: string;
}
interface AnswerParams {
  projectId: string;
  askId: string;
}

export interface RestServerOptions {
  /**
   * Allowed CORS origin for the browser UI. Defaults to `*` for local dev (the web app runs
   * on a different port than the API). In a deployed environment pass the UI's exact origin
   * (e.g. via WAYPOINT_CORS_ORIGIN) so the API is not readable from arbitrary sites.
   */
  corsOrigin?: string;
  /**
   * Absolute path to the built web SPA (the `vite build` output). When set, this same Fastify
   * server serves the UI (decision D7: one process serves API + web in the prod container),
   * with deep-link fallback to index.html. Unset in dev/tests, where Vite serves the web.
   */
  webRoot?: string;
}

// The human's answer surface. Two endpoints over the core read/answer use-cases; every
// response carries X-Request-ID for tracing and a consistent error envelope on failure.
export function createRestServer(core: Core, opts: RestServerOptions = {}): FastifyInstance {
  const app = Fastify({ logger: false });
  const corsOrigin = opts.corsOrigin ?? "*";
  const webRoot = opts.webRoot;

  // CORS: the web UI is served from a different origin than this API (dev: :5273 → :8849),
  // so without these headers the browser discards every response. Set on all routes; a
  // preflight OPTIONS is answered here (204) before routing. When the origin is restricted
  // (not `*`), `Vary: Origin` keeps shared caches from serving the wrong origin's headers.
  app.addHook("onRequest", async (req, reply) => {
    reply.header("Access-Control-Allow-Origin", corsOrigin);
    if (corsOrigin !== "*") reply.header("Vary", "Origin");
    if (req.method === "OPTIONS") {
      reply
        .header("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS")
        .header("Access-Control-Allow-Headers", "content-type")
        .header("Access-Control-Max-Age", "86400")
        .status(204)
        .send();
    }
  });

  // Stamp the per-request id on every response (success or error) for tracing.
  app.addHook("onSend", async (req, reply, payload) => {
    reply.header("X-Request-ID", req.id);
    return payload;
  });

  // Liveness/readiness probe for the container HEALTHCHECK (docker.md). Cheap and dependency-free
  // so the orchestrator can restart a wedged process without hitting the database.
  app.get("/healthz", async (_req, reply) => {
    reply.send({ status: "ok" });
  });

  // In the prod container, serve the built web SPA from this same server (D7). Registered after
  // the API routes are declared below — find-my-way matches the explicit /v1 + /healthz routes
  // before the static wildcard, so the API is never shadowed. SPA deep links 404 in static and
  // fall through to the not-found handler, which returns index.html.
  if (webRoot !== undefined) {
    void app.register(fastifyStatic, { root: webRoot });
  }

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof WaypointError) {
      reply
        .status(HTTP_STATUS[err.code])
        .send({ error: err.code, message: err.message, request_id: req.id });
      return;
    }
    // Fastify flags client faults (malformed JSON, etc.) with a 4xx statusCode. Anything
    // else is internal: respond generically so no implementation detail escapes.
    const raw = (err as { statusCode?: unknown }).statusCode;
    const status = typeof raw === "number" && raw >= 400 && raw < 500 ? raw : 500;
    const client = status < 500;
    reply.status(status).send({
      error: client ? "VALIDATION" : "INTERNAL",
      message: client ? "invalid request" : "internal error",
      request_id: req.id,
    });
  });

  // The cross-project home: one summary row per project (derived counts + last activity).
  app.get("/v1/projects", async (_req, reply) => {
    const list: ProjectListResponse = await core.listProjects();
    reply.send(list);
  });

  // The project's append-only event log (the Activity timeline). `sinceSeq` requests only
  // newer events for incremental reads; an invalid value is a client error, not silent.
  app.get<{ Params: ProjectParams; Querystring: EventsQuery }>(
    "/v1/projects/:projectId/events",
    async (req, reply) => {
      let sinceSeq: number | undefined;
      const raw = req.query.sinceSeq;
      if (raw !== undefined) {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 0) {
          throw new ValidationError("sinceSeq must be a non-negative integer", { sinceSeq: raw });
        }
        sinceSeq = n;
      }
      const log: EventLogResponse = await core.readEvents(req.params.projectId, sinceSeq);
      reply.send(log);
    },
  );

  app.get<{ Params: ProjectParams }>("/v1/projects/:projectId/inbox", async (req, reply) => {
    const inbox: InboxResponse = await core.listInbox(req.params.projectId);
    reply.send(inbox);
  });

  // The project spine (slice 2): the goal→plan→task progress tree. The client reuses the
  // existing inbox WS signal to know when to refetch this — there is no separate progress feed.
  app.get<{ Params: ProjectParams }>("/v1/projects/:projectId/progress", async (req, reply) => {
    const progress: ProjectProgress = await core.listProject(req.params.projectId);
    reply.send(progress);
  });

  // Re-entry (slice 3). The while-you-were-away digest since the caller's last-seen cursor.
  // Read-only — it does NOT advance the cursor (explicit ack below), so repeated reads are stable.
  // Pre-auth the principal is the well-known default; it becomes the authenticated user later.
  app.get<{ Params: ProjectParams }>("/v1/projects/:projectId/digest", async (req, reply) => {
    const digest: Digest = await core.digestFor(req.params.projectId, DEFAULT_PRINCIPAL);
    reply.send(digest);
  });

  // Advance the read cursor to a given seq (explicit ack — consistent with the WS resume cursor).
  app.post<{ Params: ProjectParams }>("/v1/projects/:projectId/digest/ack", async (req, reply) => {
    const parsed = DigestAckRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError("invalid digest ack body", { issues: parsed.error.issues });
    }
    const ack: DigestAckResponse = await core.ackDigest(
      req.params.projectId,
      DEFAULT_PRINCIPAL,
      parsed.data.seq,
    );
    reply.send(ack);
  });

  // The threaded project story since `sinceSeq` — the event log read back as narrative.
  app.get<{ Params: ProjectParams; Querystring: EventsQuery }>(
    "/v1/projects/:projectId/story",
    async (req, reply) => {
      let sinceSeq: number | undefined;
      const raw = req.query.sinceSeq;
      if (raw !== undefined) {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 0) {
          throw new ValidationError("sinceSeq must be a non-negative integer", { sinceSeq: raw });
        }
        sinceSeq = n;
      }
      const story: StoryResponse = await core.story(req.params.projectId, sinceSeq);
      reply.send(story);
    },
  );

  // The caller's notification policy (cadence/threshold/SLA), defaulting when none is set.
  app.get<{ Params: ProjectParams }>(
    "/v1/projects/:projectId/notification-policy",
    async (req, reply) => {
      const policy: NotificationPolicy = await core.policyFor(
        req.params.projectId,
        DEFAULT_PRINCIPAL,
      );
      reply.send(policy);
    },
  );

  // Set the caller's notification policy. PUT is idempotent — the single (principal, project) row
  // is upserted.
  app.put<{ Params: ProjectParams }>(
    "/v1/projects/:projectId/notification-policy",
    async (req, reply) => {
      const parsed = NotificationPolicySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError("invalid notification policy", { issues: parsed.error.issues });
      }
      await core.setPolicyFor(req.params.projectId, DEFAULT_PRINCIPAL, parsed.data);
      reply.send(parsed.data);
    },
  );

  app.post<{ Params: AnswerParams }>(
    "/v1/projects/:projectId/asks/:askId/answer",
    async (req, reply) => {
      const parsed = AnswerRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError("invalid answer body", { issues: parsed.error.issues });
      }
      const { projectId, askId } = req.params;
      const ask = await core.answer({
        projectId,
        askId,
        expectedVersion: parsed.data.expectedVersion,
        chosenOptionId: parsed.data.chosenOptionId,
        answerText: parsed.data.answerText,
        proposalVerdict: parsed.data.proposalVerdict,
        adjustmentNote: parsed.data.adjustmentNote,
      });
      // Report the owning node's resulting state so the client can re-rank without a refetch.
      const node = await core.getNode(projectId, ask.nodeId);
      const nodeBlocked = await core.computeBlocked(projectId, ask.nodeId);
      const body: AnswerResponse = {
        askId: ask.id,
        askState: ask.state,
        askVersion: ask.version,
        nodeId: ask.nodeId,
        nodeBlocked,
        nodeVersion: node.version,
        // Echo a proposal verdict (and its constraint) back so the client can confirm it.
        ...(parsed.data.proposalVerdict !== undefined
          ? { proposalVerdict: parsed.data.proposalVerdict }
          : {}),
        ...(parsed.data.adjustmentNote !== undefined
          ? { adjustmentNote: parsed.data.adjustmentNote }
          : {}),
      };
      reply.send(body);
    },
  );

  // Unmatched routes: a non-API GET falls back to the SPA shell when web serving is on (so
  // client-side deep links resolve); everything else gets the JSON error envelope, never HTML.
  app.setNotFoundHandler((req, reply) => {
    if (
      webRoot !== undefined &&
      req.method === "GET" &&
      !req.url.startsWith("/v1") &&
      !req.url.startsWith("/healthz")
    ) {
      void reply.type("text/html").sendFile("index.html");
      return;
    }
    reply.status(404).send({ error: "NOT_FOUND", message: "not found", request_id: req.id });
  });

  return app;
}
