import type { Node, CreateNodeInput, DependencyEdge } from "@waypoint/shared";
import type { Clock, IdGenerator, UnitOfWork } from "./ports.js";
import { NotFoundError, ValidationError } from "./errors.js";

export interface CoreDeps {
  uow: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
}

// depends_on edges are not an MCP tool in this slice; they are created by seeding and
// the (future) dependency tool. Core supports them because blast-radius ranking needs them.
export interface AddDependencyInput {
  projectId: string;
  nodeId: string;
  dependsOnId: string;
  sessionId?: string;
}

// The domain use-cases the adapters (MCP, REST) drive. Every mutation runs inside a
// single UnitOfWork transaction so the row change and its event append commit together.
export interface Core {
  createNode(input: CreateNodeInput): Promise<Node>;
  addDependency(input: AddDependencyInput): Promise<void>;
}

// True if `target` is reachable from `from` by following depends_on edges. Used to
// reject edges that would close a cycle (adding from→target while target⇒…⇒from exists).
function dependsOnReaches(edges: DependencyEdge[], from: string, target: string): boolean {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const next = adjacency.get(edge.nodeId) ?? [];
    next.push(edge.dependsOnId);
    adjacency.set(edge.nodeId, next);
  }
  const seen = new Set<string>();
  const stack = [from];
  for (let cur = stack.pop(); cur !== undefined; cur = stack.pop()) {
    if (cur === target) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const next of adjacency.get(cur) ?? []) stack.push(next);
  }
  return false;
}

export function createCore(deps: CoreDeps): Core {
  const { uow, clock, ids } = deps;

  return {
    async createNode(input) {
      return uow.run(async (ctx) => {
        const project = await ctx.projects.findById(input.projectId);
        if (!project) throw new NotFoundError("project", input.projectId);

        // A parent must exist within the same project. A parent in another project is
        // simply not visible here (repos are project-scoped), so cross-project parents
        // are rejected as validation errors without ever querying across the boundary.
        if (input.parentId !== null) {
          const parent = await ctx.nodes.findById(input.projectId, input.parentId);
          if (!parent) {
            throw new ValidationError("parent not found in project", {
              projectId: input.projectId,
              parentId: input.parentId,
            });
          }
        }

        const now = clock.now();
        const node: Node = {
          id: ids.generate(),
          projectId: input.projectId,
          parentId: input.parentId,
          kind: input.kind,
          title: input.title,
          status: "DRAFT",
          discardReason: null,
          sessionId: input.sessionId ?? null,
          version: 1,
          createdAt: now,
          updatedAt: now,
        };
        await ctx.nodes.insert(node);
        await ctx.events.append({
          id: ids.generate(),
          projectId: node.projectId,
          actor: "agent",
          verb: "node.created",
          ref: { kind: "node", id: node.id },
          sessionId: node.sessionId,
          summary: `created ${node.kind}: ${node.title}`,
          at: now,
        });
        return node;
      });
    },

    async addDependency(input) {
      return uow.run(async (ctx) => {
        const dependent = await ctx.nodes.findById(input.projectId, input.nodeId);
        if (!dependent) {
          throw new ValidationError("dependent node not found in project", {
            projectId: input.projectId,
            nodeId: input.nodeId,
          });
        }
        const target = await ctx.nodes.findById(input.projectId, input.dependsOnId);
        if (!target) {
          throw new ValidationError("dependency target not found in project", {
            projectId: input.projectId,
            dependsOnId: input.dependsOnId,
          });
        }
        if (input.nodeId === input.dependsOnId) {
          throw new ValidationError("a node cannot depend on itself", { nodeId: input.nodeId });
        }

        const edges = await ctx.nodes.listDependencies(input.projectId);
        // Adding nodeId → dependsOnId closes a cycle iff dependsOnId already reaches nodeId.
        if (dependsOnReaches(edges, input.dependsOnId, input.nodeId)) {
          throw new ValidationError("dependency would create a cycle", {
            nodeId: input.nodeId,
            dependsOnId: input.dependsOnId,
          });
        }

        const edge: DependencyEdge = {
          projectId: input.projectId,
          nodeId: input.nodeId,
          dependsOnId: input.dependsOnId,
        };
        await ctx.nodes.addDependency(edge);
        await ctx.events.append({
          id: ids.generate(),
          projectId: input.projectId,
          actor: "agent",
          verb: "dependency.added",
          ref: { kind: "node", id: input.nodeId },
          sessionId: input.sessionId ?? null,
          summary: `depends_on ${input.dependsOnId}`,
          at: clock.now(),
        });
      });
    },
  };
}
