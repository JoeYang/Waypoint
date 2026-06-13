import type { Node, CreateNodeInput } from "@waypoint/shared";
import type { Clock, IdGenerator, UnitOfWork } from "./ports.js";
import { NotFoundError, ValidationError } from "./errors.js";

export interface CoreDeps {
  uow: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
}

// The domain use-cases the adapters (MCP, REST) drive. Every mutation runs inside a
// single UnitOfWork transaction so the row change and its event append commit together.
export interface Core {
  createNode(input: CreateNodeInput): Promise<Node>;
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
  };
}
