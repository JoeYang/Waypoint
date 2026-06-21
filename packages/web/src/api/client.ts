import {
  InboxResponseSchema,
  AnswerResponseSchema,
  ProjectProgressSchema,
  ProjectListResponseSchema,
  EventLogResponseSchema,
  DigestSchema,
  DigestAckResponseSchema,
  StoryResponseSchema,
  type AnswerRequest,
  type AnswerResponse,
  type InboxResponse,
  type ProjectProgress,
  type ProjectListResponse,
  type EventLogResponse,
  type Digest,
  type DigestAckResponse,
  type StoryResponse,
} from "@waypoint/shared";

// A failed REST call, carrying the server's typed envelope code (NOT_FOUND, STALE_VERSION,
// …) so the UI can react — e.g. re-fetch the inbox on a stale answer. Never exposes the raw
// response or any internals.
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fail(res: Response): Promise<never> {
  let code = "HTTP_ERROR";
  let message = res.statusText || "request failed";
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object") {
      const envelope = body as { error?: unknown; message?: unknown };
      if (typeof envelope.error === "string") code = envelope.error;
      if (typeof envelope.message === "string") message = envelope.message;
    }
  } catch {
    // non-JSON error body — keep the status-derived message
  }
  throw new ApiError(code, message, res.status);
}

const project = (baseUrl: string, projectId: string) =>
  `${baseUrl}/v1/projects/${encodeURIComponent(projectId)}`;

// GET the ranked inbox snapshot — the deterministic first paint that races the WS connect.
export async function fetchInbox(baseUrl: string, projectId: string): Promise<InboxResponse> {
  const res = await fetch(`${project(baseUrl, projectId)}/inbox`);
  if (!res.ok) await fail(res);
  return InboxResponseSchema.parse(await res.json());
}

// GET the project spine — the goal→plan→task progress tree (slice 2). Refetched when the
// live inbox WS signal advances; no separate progress feed.
export async function fetchProgress(baseUrl: string, projectId: string): Promise<ProjectProgress> {
  const res = await fetch(`${project(baseUrl, projectId)}/progress`);
  if (!res.ok) await fail(res);
  return ProjectProgressSchema.parse(await res.json());
}

// GET the cross-project list (the home): each project with its derived counts.
export async function fetchProjects(baseUrl: string): Promise<ProjectListResponse> {
  const res = await fetch(`${baseUrl}/v1/projects`);
  if (!res.ok) await fail(res);
  return ProjectListResponseSchema.parse(await res.json());
}

// GET the project event log (the Activity timeline). `sinceSeq` requests only newer events.
export async function fetchEvents(
  baseUrl: string,
  projectId: string,
  sinceSeq?: number,
): Promise<EventLogResponse> {
  const url =
    sinceSeq === undefined
      ? `${project(baseUrl, projectId)}/events`
      : `${project(baseUrl, projectId)}/events?sinceSeq=${sinceSeq}`;
  const res = await fetch(url);
  if (!res.ok) await fail(res);
  return EventLogResponseSchema.parse(await res.json());
}

// GET the while-you-were-away digest since the caller's last-seen cursor (re-entry, slice 3).
// Read-only — the cursor is advanced separately by ackDigest, so repeated reads are stable.
export async function fetchDigest(baseUrl: string, projectId: string): Promise<Digest> {
  const res = await fetch(`${project(baseUrl, projectId)}/digest`);
  if (!res.ok) await fail(res);
  return DigestSchema.parse(await res.json());
}

// POST an explicit cursor ack to `seq` — the human has seen the digest up to here. Idempotent
// and monotonic server-side (an ack to an older seq is a no-op).
export async function ackDigest(
  baseUrl: string,
  projectId: string,
  seq: number,
): Promise<DigestAckResponse> {
  const res = await fetch(`${project(baseUrl, projectId)}/digest/ack`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ seq }),
  });
  if (!res.ok) await fail(res);
  return DigestAckResponseSchema.parse(await res.json());
}

// GET the threaded project story — the event log read back as narrative. `sinceSeq` requests
// only newer entries.
export async function fetchStory(
  baseUrl: string,
  projectId: string,
  sinceSeq?: number,
): Promise<StoryResponse> {
  const url =
    sinceSeq === undefined
      ? `${project(baseUrl, projectId)}/story`
      : `${project(baseUrl, projectId)}/story?sinceSeq=${sinceSeq}`;
  const res = await fetch(url);
  if (!res.ok) await fail(res);
  return StoryResponseSchema.parse(await res.json());
}

// POST a human answer. The caller supplies expected_version from the inbox item so the
// server can reject a stale write rather than overwrite.
export async function answerAsk(
  baseUrl: string,
  projectId: string,
  askId: string,
  req: AnswerRequest,
): Promise<AnswerResponse> {
  const res = await fetch(
    `${project(baseUrl, projectId)}/asks/${encodeURIComponent(askId)}/answer`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    },
  );
  if (!res.ok) await fail(res);
  return AnswerResponseSchema.parse(await res.json());
}
