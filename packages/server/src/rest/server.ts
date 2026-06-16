import Fastify, { type FastifyInstance } from "fastify";
import {
  AnswerRequestSchema,
  type AnswerResponse,
  type InboxResponse,
  type ProjectProgress,
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
interface AnswerParams {
  projectId: string;
  askId: string;
}

// The human's answer surface. Two endpoints over the core read/answer use-cases; every
// response carries X-Request-ID for tracing and a consistent error envelope on failure.
export function createRestServer(core: Core): FastifyInstance {
  const app = Fastify({ logger: false });

  // Stamp the per-request id on every response (success or error) for tracing.
  app.addHook("onSend", async (req, reply, payload) => {
    reply.header("X-Request-ID", req.id);
    return payload;
  });

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

  return app;
}
