import type {
  Project,
  ProjectSummary,
  Node,
  Ask,
  Event,
  DependencyEdge,
  NotificationPolicy,
} from "@waypoint/shared";

// Outbound ports declared by the domain and implemented by adapters (server/Postgres,
// in-memory fakes in tests). Core reaches persistence, time, and identity ONLY through
// these — never a concrete driver, the OS clock, or a random source (deterministic tests).

// Injected time source. Epoch milliseconds. Never read the OS clock inside core.
export interface Clock {
  now(): number;
}

// Injected identity source for node/ask/event ids. Lets core build fully-formed,
// deterministic entities in tests; the Postgres adapter supplies real uuids.
export interface IdGenerator {
  generate(): string;
}

export interface ProjectRepository {
  findById(id: string): Promise<Project | null>;
  // Idempotent create: insert the project if absent. Returns true when it created a new row,
  // false when the id already existed (`ON CONFLICT (id) DO NOTHING` in Postgres). The
  // in-memory fake honours the SAME contract — never overwrites an existing project.
  insert(project: Project): Promise<boolean>;
  // Every project with read-time-derived counts for the cross-project home. The adapter
  // computes the aggregate in ONE query (no N+1 over projects): open asks, agent-occupied
  // tasks, and the newest event's timestamp per project.
  listSummaries(): Promise<ProjectSummary[]>;
}

export interface NodeRepository {
  findById(projectId: string, id: string): Promise<Node | null>;
  listByProject(projectId: string): Promise<Node[]>;
  insert(node: Node): Promise<void>;
  update(node: Node): Promise<void>;
  addDependency(edge: DependencyEdge): Promise<void>;
  listDependencies(projectId: string): Promise<DependencyEdge[]>;
}

export interface AskRepository {
  findById(projectId: string, id: string): Promise<Ask | null>;
  listByProject(projectId: string): Promise<Ask[]>;
  insert(ask: Ask): Promise<void>;
  update(ask: Ask): Promise<void>;
}

// The event being appended, minus the `seq` the log assigns monotonically per project.
export type EventDraft = Omit<Event, "seq">;

export interface EventLog {
  // Appends atomically and returns the stored event with its assigned per-project seq.
  append(draft: EventDraft): Promise<Event>;
  // Events strictly after `afterSeq`, ascending — drives WebSocket resume-since-seq.
  listSince(projectId: string, afterSeq: number): Promise<Event[]>;
  // Oldest seq still retained; if a client's lastSeq is below this, it must full-resync.
  earliestRetainedSeq(projectId: string): Promise<number | null>;
}

// Per-principal re-entry state (V2 slice 3): the read cursor (highest acknowledged event seq)
// and the notification policy. Keyed (principal, projectId) — project_id is the tenant boundary,
// principal the future per-user boundary (a default principal pre-auth). NOT the event log: these
// are mutable support rows; the log stays append-only.
export interface CursorRepository {
  // Highest event seq the principal has acknowledged seeing; 0 if never visited.
  getLastSeen(principal: string, projectId: string): Promise<number>;
  // Persist the cursor. Callers guard monotonicity (never move it backward); this just writes.
  setLastSeen(principal: string, projectId: string, seq: number): Promise<void>;
  // The principal's notification policy, or null if they have set none (caller falls back to the
  // application default).
  getPolicy(principal: string, projectId: string): Promise<NotificationPolicy | null>;
  setPolicy(principal: string, projectId: string, policy: NotificationPolicy): Promise<void>;
}

// The repositories visible inside a transaction. Reads issued here participate in the
// same transaction as writes, so read-compare-write version guards are race-safe.
export interface RepositoryContext {
  readonly projects: ProjectRepository;
  readonly nodes: NodeRepository;
  readonly asks: AskRepository;
  readonly events: EventLog;
  readonly cursors: CursorRepository;
}

// Transaction boundary. `work` runs atomically: if it throws, nothing is persisted
// (no partial state) — satisfying "mutation + its event append are one transaction".
export interface UnitOfWork {
  run<T>(work: (ctx: RepositoryContext) => Promise<T>): Promise<T>;
}
