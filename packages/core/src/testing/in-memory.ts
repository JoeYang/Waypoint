import type { Project, Node, Ask, Event, DependencyEdge } from "@waypoint/shared";
import type {
  Clock,
  IdGenerator,
  ProjectRepository,
  NodeRepository,
  AskRepository,
  EventLog,
  RepositoryContext,
  UnitOfWork,
} from "../ports.js";

// Deterministic time source for tests. Starts at a fixed epoch; advance with tick().
export class FakeClock implements Clock {
  constructor(private current = 1_000) {}
  now(): number {
    return this.current;
  }
  tick(ms = 1): this {
    this.current += ms;
    return this;
  }
}

// Deterministic, sequential ids: `${prefix}-1`, `${prefix}-2`, …
export class FakeIdGenerator implements IdGenerator {
  private n = 0;
  constructor(private readonly prefix = "id") {}
  generate(): string {
    this.n += 1;
    return `${this.prefix}-${this.n}`;
  }
}

interface State {
  projects: Map<string, Project>;
  nodes: Map<string, Node>;
  asks: Map<string, Ask>;
  edges: DependencyEdge[];
  events: Event[];
  seq: Map<string, number>;
}

const emptyState = (): State => ({
  projects: new Map(),
  nodes: new Map(),
  asks: new Map(),
  edges: [],
  events: [],
  seq: new Map(),
});

// In-memory implementation of every port, used by core's unit tests and reused as the
// reference the Postgres repositories must match (task 4.3). The UnitOfWork snapshots
// state and restores it if `work` throws, giving the same all-or-nothing atomicity the
// real transaction provides — so "no partial state on failure" is exercised here too.
export class InMemoryBackend {
  state: State = emptyState();

  readonly projects: ProjectRepository = {
    findById: async (id) => this.state.projects.get(id) ?? null,
  };

  readonly nodes: NodeRepository = {
    findById: async (projectId, id) => {
      const node = this.state.nodes.get(id);
      return node && node.projectId === projectId ? structuredClone(node) : null;
    },
    listByProject: async (projectId) =>
      [...this.state.nodes.values()]
        .filter((n) => n.projectId === projectId)
        .map((n) => structuredClone(n)),
    insert: async (node) => {
      this.state.nodes.set(node.id, structuredClone(node));
    },
    update: async (node) => {
      this.state.nodes.set(node.id, structuredClone(node));
    },
    addDependency: async (edge) => {
      this.state.edges.push(structuredClone(edge));
    },
    listDependencies: async (projectId) =>
      this.state.edges.filter((e) => e.projectId === projectId).map((e) => ({ ...e })),
  };

  readonly asks: AskRepository = {
    findById: async (projectId, id) => {
      const ask = this.state.asks.get(id);
      return ask && ask.projectId === projectId ? structuredClone(ask) : null;
    },
    listByProject: async (projectId) =>
      [...this.state.asks.values()]
        .filter((a) => a.projectId === projectId)
        .map((a) => structuredClone(a)),
    insert: async (ask) => {
      this.state.asks.set(ask.id, structuredClone(ask));
    },
    update: async (ask) => {
      this.state.asks.set(ask.id, structuredClone(ask));
    },
  };

  readonly events: EventLog = {
    append: async (draft) => {
      const next = (this.state.seq.get(draft.projectId) ?? 0) + 1;
      this.state.seq.set(draft.projectId, next);
      const event: Event = { ...draft, seq: next };
      this.state.events.push(structuredClone(event));
      return structuredClone(event);
    },
    listSince: async (projectId, afterSeq) =>
      this.state.events
        .filter((e) => e.projectId === projectId && e.seq > afterSeq)
        .sort((a, b) => a.seq - b.seq)
        .map((e) => structuredClone(e)),
    earliestRetainedSeq: async (projectId) => {
      const seqs = this.state.events.filter((e) => e.projectId === projectId).map((e) => e.seq);
      return seqs.length > 0 ? Math.min(...seqs) : null;
    },
  };

  readonly uow: UnitOfWork = {
    run: async (work) => {
      const snapshot = structuredClone(this.state);
      try {
        return await work(this.repositoryContext());
      } catch (err) {
        this.state = snapshot; // rollback — no partial state observable
        throw err;
      }
    },
  };

  // Test helper: projects are seeded (no creation use-case in this slice).
  seedProject(project: Project): void {
    this.state.projects.set(project.id, structuredClone(project));
  }

  private repositoryContext(): RepositoryContext {
    return { projects: this.projects, nodes: this.nodes, asks: this.asks, events: this.events };
  }
}
