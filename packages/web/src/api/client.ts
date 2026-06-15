import {
  InboxResponseSchema,
  AnswerResponseSchema,
  ProjectProgressSchema,
  type AnswerRequest,
  type AnswerResponse,
  type InboxResponse,
  type ProjectProgress,
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
