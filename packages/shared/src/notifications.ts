import { z } from "zod";

// Notification contract (V2 slice 3). Tiered + batched: most asks wait silently for the next
// visit; a digest is delivered on a cadence; a single push escalates only when an ask's blast
// radius crosses a threshold or it ages past an SLA. Never one notification per ask. The policy
// is user-set and persisted; the escalation decision is a pure core use-case (no transport here).

// User-set thresholds. Pre-auth these key on the default principal (mirroring DEFAULT_PROJECT_ID);
// the same row becomes per-user when auth lands, with no schema change.
export const NotificationPolicySchema = z.object({
  blastRadiusThreshold: z.number().int().positive(), // escalate a push when ask blastRadius >= this
  ageSlaSeconds: z.number().int().positive(), // escalate a push when ask age >= this
  digestCadenceSeconds: z.number().int().positive(), // batch-digest delivery interval
});
export type NotificationPolicy = z.infer<typeof NotificationPolicySchema>;

// The escalation decision input for a single ask, evaluated against a policy. `waitingCount` is
// the number of asks currently waiting (context for the summary, not the per-ask decision).
export const EscalationInputSchema = z.object({
  askId: z.string().min(1),
  blastRadius: z.number().int().nonnegative(),
  ageSeconds: z.number().int().nonnegative(),
  waitingCount: z.number().int().nonnegative(),
});
export type EscalationInput = z.infer<typeof EscalationInputSchema>;

// Why an ask escalated (or didn't). `threshold` = blast radius crossed; `sla` = aged past SLA;
// `none` = batch it into the next digest.
export const ESCALATION_REASONS = ["threshold", "sla", "none"] as const;
export const EscalationReason = z.enum(ESCALATION_REASONS);
export type EscalationReason = z.infer<typeof EscalationReason>;

export const EscalationDecisionSchema = z.object({
  push: z.boolean(), // true → emit a single push now; false → batch into the digest
  reason: EscalationReason,
});
export type EscalationDecision = z.infer<typeof EscalationDecisionSchema>;
