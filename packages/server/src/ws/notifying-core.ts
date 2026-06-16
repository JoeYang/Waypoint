import type { Core } from "@waypoint/core";
import type { InboxHub } from "./hub.js";

// Wraps a Core so every successful mutation triggers a post-commit hub.notify. This is the
// single wiring point for live deltas — both transports (MCP and REST) drive the wrapped
// core, so no adapter can forget to publish. Reads pass through untouched.
//
// notify runs AFTER the use-case resolves, i.e. after the transaction commits, so a
// rolled-back change never emits a delta. A notify failure is swallowed: the row already
// committed durably and clients recover via resume-since-seq, so the live push is
// best-effort and must never fail the caller's mutation.
export function createNotifyingCore(core: Core, hub: InboxHub): Core {
  const publish = async <T>(projectId: string, result: T): Promise<T> => {
    try {
      await hub.notify(projectId);
    } catch {
      // best-effort live push; the durable event log + resume-since-seq are the truth
    }
    return result;
  };

  return {
    ...core,
    createNode: async (input) => publish(input.projectId, await core.createNode(input)),
    addDependency: async (input) => publish(input.projectId, await core.addDependency(input)),
    transition: async (input) => publish(input.projectId, await core.transition(input)),
    parkAsk: async (input) => publish(input.projectId, await core.parkAsk(input)),
    assume: async (input) => publish(input.projectId, await core.assume(input)),
    confirmAssumption: async (input) =>
      publish(input.projectId, await core.confirmAssumption(input)),
    overturnAssumption: async (input) =>
      publish(input.projectId, await core.overturnAssumption(input)),
    answer: async (input) => publish(input.projectId, await core.answer(input)),
  };
}
