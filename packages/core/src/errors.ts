// Typed domain errors. Adapters map `code` to a transport status (HTTP / MCP) and must
// never leak internals or stack traces (see security.md). Thrown by core use-cases and
// by the repository ports; the discriminant `code` lets adapters switch without instanceof.
export type ErrorCode = "NOT_FOUND" | "VALIDATION" | "STALE_VERSION" | "BACKEND_UNAVAILABLE";

export abstract class WaypointError extends Error {
  abstract readonly code: ErrorCode;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class NotFoundError extends WaypointError {
  readonly code = "NOT_FOUND";
  constructor(
    readonly entity: "project" | "node" | "ask",
    readonly id: string,
  ) {
    super(`${entity} not found: ${id}`);
  }
}

export class ValidationError extends WaypointError {
  readonly code = "VALIDATION";
  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

// Optimistic-concurrency conflict. Carries the actual current version so the adapter can
// return the current state to the caller (who then re-reads and re-triages).
export class StaleVersionError extends WaypointError {
  readonly code = "STALE_VERSION";
  constructor(
    readonly entity: "node" | "ask",
    readonly id: string,
    readonly expectedVersion: number,
    readonly actualVersion: number,
  ) {
    super(
      `stale version for ${entity} ${id}: expected ${expectedVersion}, found ${actualVersion}`,
    );
  }
}

// Persistence unreachable or a transaction failed. Part of the port failure contract;
// adapters surface it as a typed "unavailable" error with no partial state observable.
export class BackendUnavailableError extends WaypointError {
  readonly code = "BACKEND_UNAVAILABLE";
  constructor(message = "backend unavailable", options?: { cause?: unknown }) {
    super(message, options);
  }
}
