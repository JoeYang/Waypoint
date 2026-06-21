import { describe, it, expect } from "vitest";
import {
  StoryEntrySchema,
  StoryResponseSchema,
  DigestSchema,
  DigestAskSchema,
  DigestAckRequestSchema,
} from "../reentry.js";
import {
  NotificationPolicySchema,
  EscalationInputSchema,
  EscalationDecisionSchema,
} from "../notifications.js";
import { WsServerFrameSchema, WsDigestReadySchema } from "../ws.js";

// Contracts for V2 slice 3 (async-reentry-and-notifications): the wire shapes only.
// Behaviour (core projections, server endpoint, notifier) is covered in core + server suites.

describe("StoryEntry", () => {
  const base = {
    seq: 5,
    at: 1700000000000,
    actor: "agent",
    actorLabel: "brave-lark",
    verb: "node.transitioned",
    nodeId: "n1",
    nodeTitle: "Ship the build",
    summary: "moved to DONE",
  };

  it("accepts a node-threaded entry with a resolved actor label", () => {
    const e = StoryEntrySchema.parse(base);
    expect(e.actorLabel).toBe("brave-lark");
    expect(e.verb).toBe("node.transitioned");
  });

  it("allows a null actor label (human / unattributed) and null title/summary", () => {
    const e = StoryEntrySchema.parse({
      ...base,
      actor: "human",
      actorLabel: null,
      nodeTitle: null,
      summary: null,
    });
    expect(e.actorLabel).toBeNull();
    expect(e.summary).toBeNull();
  });

  it("rejects a non-positive seq (events start at 1)", () => {
    expect(StoryEntrySchema.safeParse({ ...base, seq: 0 }).success).toBe(false);
  });

  it("rejects an unknown verb", () => {
    expect(StoryEntrySchema.safeParse({ ...base, verb: "node.deleted" }).success).toBe(false);
  });
});

describe("StoryResponse", () => {
  it("accepts an empty narrative at seq 0 (never visited / nothing yet)", () => {
    const r = StoryResponseSchema.parse({ projectId: "p1", seq: 0, entries: [] });
    expect(r.entries).toHaveLength(0);
  });
});

describe("Digest", () => {
  const ask = {
    askId: "a1",
    nodeId: "n1",
    nodeTitle: "Pick a DB",
    type: "DECISION",
    prompt: "Postgres or SQLite?",
    blastRadius: 3,
    ageMs: 7200000,
  };

  it("accepts the three rolled-up buckets", () => {
    const d = DigestSchema.parse({
      projectId: "p1",
      sinceSeq: 10,
      seq: 18,
      shipped: [{ nodeId: "n2", kind: "task", title: "Wire the spine" }],
      newlyBlocked: [{ nodeId: "n1", kind: "task", title: "Pick a DB" }],
      waiting: [ask],
    });
    expect(d.shipped).toHaveLength(1);
    expect(d.newlyBlocked).toHaveLength(1);
    expect(d.waiting[0]?.blastRadius).toBe(3);
  });

  it("accepts an empty digest (nothing changed since the cursor)", () => {
    const d = DigestSchema.parse({
      projectId: "p1",
      sinceSeq: 18,
      seq: 18,
      shipped: [],
      newlyBlocked: [],
      waiting: [],
    });
    expect(d.sinceSeq).toBe(18);
  });

  it("rejects a negative ageMs", () => {
    expect(DigestAskSchema.safeParse({ ...ask, ageMs: -1 }).success).toBe(false);
  });
});

describe("DigestAckRequest", () => {
  it("accepts a non-negative ack seq (0 = reset to start)", () => {
    expect(DigestAckRequestSchema.parse({ seq: 0 }).seq).toBe(0);
  });
  it("rejects a negative seq", () => {
    expect(DigestAckRequestSchema.safeParse({ seq: -2 }).success).toBe(false);
  });
});

describe("NotificationPolicy", () => {
  it("accepts user-set thresholds", () => {
    const p = NotificationPolicySchema.parse({
      blastRadiusThreshold: 5,
      ageSlaSeconds: 14400,
      digestCadenceSeconds: 86400,
    });
    expect(p.blastRadiusThreshold).toBe(5);
  });

  it("rejects a non-positive threshold", () => {
    expect(
      NotificationPolicySchema.safeParse({
        blastRadiusThreshold: 0,
        ageSlaSeconds: 1,
        digestCadenceSeconds: 1,
      }).success,
    ).toBe(false);
  });
});

describe("EscalationInput / EscalationDecision", () => {
  it("accepts a per-ask escalation input", () => {
    const i = EscalationInputSchema.parse({
      askId: "a1",
      blastRadius: 4,
      ageSeconds: 100,
      waitingCount: 2,
    });
    expect(i.waitingCount).toBe(2);
  });

  it("models a push decision with a reason", () => {
    const d = EscalationDecisionSchema.parse({ push: true, reason: "threshold" });
    expect(d.push).toBe(true);
    expect(d.reason).toBe("threshold");
  });

  it("rejects an unknown reason", () => {
    expect(EscalationDecisionSchema.safeParse({ push: false, reason: "whim" }).success).toBe(false);
  });
});

describe("digest.ready WS frame", () => {
  const frame = {
    type: "digest.ready",
    seq: 18,
    reason: "threshold",
    askId: "a1",
    summary: "1 high-impact decision is waiting",
  };

  it("is part of the server frame union", () => {
    const f = WsServerFrameSchema.parse(frame);
    expect(f.type).toBe("digest.ready");
  });

  it("rejects 'none' as a frame reason (a batched ask never pushes)", () => {
    expect(WsDigestReadySchema.safeParse({ ...frame, reason: "none" }).success).toBe(false);
  });

  it("requires a non-empty summary (carries no sensitive payload, but must say something)", () => {
    expect(WsDigestReadySchema.safeParse({ ...frame, summary: "" }).success).toBe(false);
  });
});
