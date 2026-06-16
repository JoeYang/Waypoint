import type { Pool, PoolClient } from "pg";
import type {
  NodeKind,
  NodeStatus,
  AskType,
  AskState,
  AskOption,
  Risk,
  Actor,
  EventVerb,
  Project,
  Node,
  Ask,
  Event,
  DependencyEdge,
} from "@waypoint/shared";
import type {
  ProjectRepository,
  NodeRepository,
  AskRepository,
  EventLog,
  EventDraft,
  RepositoryContext,
  UnitOfWork,
} from "@waypoint/core";
import { BackendUnavailableError, WaypointError } from "@waypoint/core";

// Anything that can run a query — the pool or a transaction-bound client.
type Queryable = Pick<PoolClient, "query">;

interface ProjectRow {
  id: string;
  name: string;
  created_at: string;
}
interface NodeRow {
  id: string;
  project_id: string;
  parent_id: string | null;
  kind: string;
  title: string;
  status: string;
  discard_reason: string | null;
  session_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}
interface AskRow {
  id: string;
  project_id: string;
  node_id: string;
  type: string;
  state: string;
  required: boolean;
  prompt: string;
  rationale: string | null;
  risk: string;
  reversible: boolean;
  options: AskOption[];
  suggested_answers: string[];
  agent_label: string | null;
  chosen_option_id: string | null;
  assumption: string | null;
  answer_text: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}
interface EventRow {
  id: string;
  project_id: string;
  seq: string;
  actor: string;
  verb: string;
  ref_kind: string;
  ref_id: string;
  session_id: string | null;
  summary: string | null;
  at: string;
}
interface DependencyRow {
  project_id: string;
  node_id: string;
  depends_on_id: string;
}

const toProject = (r: ProjectRow): Project => ({
  id: r.id,
  name: r.name,
  createdAt: Number(r.created_at),
});
const toNode = (r: NodeRow): Node => ({
  id: r.id,
  projectId: r.project_id,
  parentId: r.parent_id,
  kind: r.kind as NodeKind,
  title: r.title,
  status: r.status as NodeStatus,
  discardReason: r.discard_reason,
  sessionId: r.session_id,
  version: r.version,
  createdAt: Number(r.created_at),
  updatedAt: Number(r.updated_at),
});
const toAsk = (r: AskRow): Ask => ({
  id: r.id,
  projectId: r.project_id,
  nodeId: r.node_id,
  type: r.type as AskType,
  state: r.state as AskState,
  required: r.required,
  prompt: r.prompt,
  // Decision context (migration 0002). Per-option consequence rides in the options jsonb.
  rationale: r.rationale,
  // Agent-supplied risk + reversibility (migration 0003).
  risk: r.risk as Risk,
  reversible: r.reversible,
  options: r.options,
  suggestedAnswers: r.suggested_answers,
  agentLabel: r.agent_label,
  chosenOptionId: r.chosen_option_id,
  assumption: r.assumption,
  answerText: r.answer_text,
  version: r.version,
  createdAt: Number(r.created_at),
  updatedAt: Number(r.updated_at),
});
const toEvent = (r: EventRow): Event => ({
  id: r.id,
  projectId: r.project_id,
  seq: Number(r.seq),
  actor: r.actor as Actor,
  verb: r.verb as EventVerb,
  ref: { kind: r.ref_kind as "node" | "ask", id: r.ref_id },
  sessionId: r.session_id,
  summary: r.summary,
  at: Number(r.at),
});

// Repositories bound to a transaction client. findById locks its row (FOR UPDATE) so the
// core read-compare-write version guard serialises against concurrent mutators.
function makeContext(db: Queryable): RepositoryContext {
  const projects: ProjectRepository = {
    findById: async (id) => {
      const { rows } = await db.query<ProjectRow>("SELECT * FROM project WHERE id = $1", [id]);
      return rows[0] ? toProject(rows[0]) : null;
    },
  };

  const nodes: NodeRepository = {
    findById: async (projectId, id) => {
      const { rows } = await db.query<NodeRow>(
        "SELECT * FROM node WHERE project_id = $1 AND id = $2 FOR UPDATE",
        [projectId, id],
      );
      return rows[0] ? toNode(rows[0]) : null;
    },
    listByProject: async (projectId) => {
      const { rows } = await db.query<NodeRow>("SELECT * FROM node WHERE project_id = $1", [
        projectId,
      ]);
      return rows.map(toNode);
    },
    insert: async (n) => {
      await db.query(
        `INSERT INTO node (id, project_id, parent_id, kind, title, status, discard_reason,
           session_id, version, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          n.id,
          n.projectId,
          n.parentId,
          n.kind,
          n.title,
          n.status,
          n.discardReason,
          n.sessionId,
          n.version,
          n.createdAt,
          n.updatedAt,
        ],
      );
    },
    update: async (n) => {
      await db.query(
        `UPDATE node SET parent_id=$3, kind=$4, title=$5, status=$6, discard_reason=$7,
           session_id=$8, version=$9, updated_at=$10 WHERE project_id=$1 AND id=$2`,
        [
          n.projectId,
          n.id,
          n.parentId,
          n.kind,
          n.title,
          n.status,
          n.discardReason,
          n.sessionId,
          n.version,
          n.updatedAt,
        ],
      );
    },
    addDependency: async (e) => {
      await db.query(
        "INSERT INTO dependency (project_id, node_id, depends_on_id) VALUES ($1,$2,$3)",
        [e.projectId, e.nodeId, e.dependsOnId],
      );
    },
    listDependencies: async (projectId) => {
      const { rows } = await db.query<DependencyRow>(
        "SELECT * FROM dependency WHERE project_id = $1",
        [projectId],
      );
      return rows.map(
        (r): DependencyEdge => ({
          projectId: r.project_id,
          nodeId: r.node_id,
          dependsOnId: r.depends_on_id,
        }),
      );
    },
  };

  const asks: AskRepository = {
    findById: async (projectId, id) => {
      const { rows } = await db.query<AskRow>(
        "SELECT * FROM ask WHERE project_id = $1 AND id = $2 FOR UPDATE",
        [projectId, id],
      );
      return rows[0] ? toAsk(rows[0]) : null;
    },
    listByProject: async (projectId) => {
      const { rows } = await db.query<AskRow>("SELECT * FROM ask WHERE project_id = $1", [
        projectId,
      ]);
      return rows.map(toAsk);
    },
    insert: async (a) => {
      await db.query(
        `INSERT INTO ask (id, project_id, node_id, type, state, required, prompt, rationale,
           options, suggested_answers, agent_label, chosen_option_id, assumption, answer_text,
           version, created_at, updated_at, risk, reversible)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [
          a.id,
          a.projectId,
          a.nodeId,
          a.type,
          a.state,
          a.required,
          a.prompt,
          a.rationale,
          JSON.stringify(a.options),
          JSON.stringify(a.suggestedAnswers),
          a.agentLabel,
          a.chosenOptionId,
          a.assumption,
          a.answerText,
          a.version,
          a.createdAt,
          a.updatedAt,
          a.risk,
          a.reversible,
        ],
      );
    },
    update: async (a) => {
      await db.query(
        `UPDATE ask SET state=$3, required=$4, prompt=$5, rationale=$6, options=$7::jsonb,
           suggested_answers=$8::jsonb, agent_label=$9, chosen_option_id=$10, assumption=$11,
           answer_text=$12, version=$13, updated_at=$14 WHERE project_id=$1 AND id=$2`,
        [
          a.projectId,
          a.id,
          a.state,
          a.required,
          a.prompt,
          a.rationale,
          JSON.stringify(a.options),
          JSON.stringify(a.suggestedAnswers),
          a.agentLabel,
          a.chosenOptionId,
          a.assumption,
          a.answerText,
          a.version,
          a.updatedAt,
        ],
      );
    },
  };

  const events: EventLog = {
    append: async (draft: EventDraft) => {
      // Bump the per-project counter under its row lock, then insert with that seq.
      const counter = await db.query<{ seq_counter: string }>(
        "UPDATE project SET seq_counter = seq_counter + 1 WHERE id = $1 RETURNING seq_counter",
        [draft.projectId],
      );
      const seq = Number(counter.rows[0]?.seq_counter);
      await db.query(
        `INSERT INTO event (id, project_id, seq, actor, verb, ref_kind, ref_id, session_id, summary, at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          draft.id,
          draft.projectId,
          seq,
          draft.actor,
          draft.verb,
          draft.ref.kind,
          draft.ref.id,
          draft.sessionId,
          draft.summary,
          draft.at,
        ],
      );
      return { ...draft, seq };
    },
    listSince: async (projectId, afterSeq) => {
      const { rows } = await db.query<EventRow>(
        "SELECT * FROM event WHERE project_id = $1 AND seq > $2 ORDER BY seq ASC",
        [projectId, afterSeq],
      );
      return rows.map(toEvent);
    },
    earliestRetainedSeq: async (projectId) => {
      const { rows } = await db.query<{ min: string | null }>(
        "SELECT MIN(seq) AS min FROM event WHERE project_id = $1",
        [projectId],
      );
      const min = rows[0]?.min;
      return min === null || min === undefined ? null : Number(min);
    },
  };

  return { projects, nodes, asks, events };
}

// Connection-level failures we surface as a typed "unavailable" error.
function isUnavailable(err: unknown): boolean {
  const code = (err as { code?: string }).code;
  return (
    code !== undefined &&
    [
      "ECONNREFUSED",
      "ETIMEDOUT",
      "ENOTFOUND",
      "08000",
      "08003",
      "08006",
      "57P01",
      "57P03",
    ].includes(code)
  );
}

export interface PgBackend {
  uow: UnitOfWork;
}

// Implements core's UnitOfWork over a pg Pool: each run() takes one connection, BEGIN /
// COMMIT around the work, ROLLBACK on any throw so no partial state is ever observable.
// Domain errors propagate unchanged; connection failures become BackendUnavailableError.
export function createPgBackend(pool: Pool): PgBackend {
  const uow: UnitOfWork = {
    run: async (work) => {
      let client: PoolClient;
      try {
        client = await pool.connect();
      } catch (err) {
        throw new BackendUnavailableError("could not acquire a database connection", {
          cause: err,
        });
      }
      try {
        await client.query("BEGIN");
        const result = await work(makeContext(client));
        await client.query("COMMIT");
        return result;
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // ignore rollback failure; the original error is what matters
        }
        if (err instanceof WaypointError) throw err;
        if (isUnavailable(err)) {
          throw new BackendUnavailableError("database unavailable", { cause: err });
        }
        throw err;
      } finally {
        client.release();
      }
    },
  };
  return { uow };
}
