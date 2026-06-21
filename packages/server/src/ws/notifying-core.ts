import type { Core } from "@waypoint/core";
import { DEFAULT_PRINCIPAL } from "@waypoint/shared";
import type { InboxHub } from "./hub.js";

// Wraps a Core so every successful mutation triggers a post-commit hub.notify. This is the
// single wiring point for live deltas — both transports (MCP and REST) drive the wrapped
// core, so no adapter can forget to publish. Reads pass through untouched.
//
// notify runs AFTER the use-case resolves, i.e. after the transaction commits, so a
// rolled-back change never emits a delta. A notify failure is swallowed: the row already
// committed durably and clients recover via resume-since-seq, so the live push is
// best-effort and must never fail the caller's mutation.

// A non-sensitive escalation summary (security.md: never the prompt/payload — the seq + a glance).
function escalationSummary(waitingCount: number, reason: "threshold" | "sla"): string {
  const why = reason === "threshold" ? "a high-impact decision" : "an ask past its SLA";
  return `${waitingCount} waiting — ${why} needs you`;
}

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
    // parkAsk both publishes the live delta AND runs the tiered notifier: it escalates a single
    // `digest.ready` frame only when the policy says push (blast radius or SLA), never one-per-ask.
    // Both pushes are best-effort — a transport failure never fails the park, and the durable log +
    // digest-on-return remain the source of truth.
    parkAsk: async (input) => {
      const ask = await core.parkAsk(input);
      let seq = 0;
      try {
        seq = (await hub.notify(input.projectId)).seq;
      } catch {
        // best-effort live delta
      }
      try {
        const policy = await core.policyFor(input.projectId, DEFAULT_PRINCIPAL);
        const { decision, input: esc } = await core.evaluateEscalation(
          input.projectId,
          ask.id,
          policy,
        );
        if (decision.push && (decision.reason === "threshold" || decision.reason === "sla")) {
          hub.broadcast(input.projectId, {
            type: "digest.ready",
            seq,
            reason: decision.reason,
            askId: ask.id,
            summary: escalationSummary(esc.waitingCount, decision.reason),
          });
        }
      } catch {
        // best-effort tiered notify; digest-on-return still surfaces the ask
      }
      return ask;
    },
    assume: async (input) => publish(input.projectId, await core.assume(input)),
    confirmAssumption: async (input) =>
      publish(input.projectId, await core.confirmAssumption(input)),
    overturnAssumption: async (input) =>
      publish(input.projectId, await core.overturnAssumption(input)),
    answer: async (input) => publish(input.projectId, await core.answer(input)),
  };
}
