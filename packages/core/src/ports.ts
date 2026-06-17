import type { Project, ProjectSummary, Node, Ask, Event, DependencyEdge } from "@waypoint/shared";

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

// The repositories visible inside a transaction. Reads issued here participate in the
// same transaction as writes, so read-compare-write version guards are race-safe.
export interface RepositoryContext {
  readonly projects: ProjectRepository;
  readonly nodes: NodeRepository;
  readonly asks: AskRepository;
  readonly events: EventLog;
}

// Transaction boundary. `work` runs atomically: if it throws, nothing is persisted
// (no partial state) — satisfying "mutation + its event append are one transaction".
export interface UnitOfWork {
  run<T>(work: (ctx: RepositoryContext) => Promise<T>): Promise<T>;
}
