import { describe, it, expect } from "vitest";
import { AskOptionSchema, AskSchema } from "../ask.js";
import { ParkAskInputSchema, parkAskInputShape } from "../mcp.js";
import { InboxItemSchema, AnswerRequestSchema } from "../inbox.js";
import { z } from "zod";

// Contracts for V2 slice 1 (decision-context-and-actions): the schema shapes only.
// Behaviour (core persisting/surfacing these) is covered in core + server suites.

describe("AskOption.consequence", () => {
  it("accepts an option with a consequence", () => {
    const o = AskOptionSchema.parse({
      id: "opt-1",
      label: "Postgres",
      consequence: "stable across retries",
    });
    expect(o.consequence).toBe("stable across retries");
  });

  it("allows an option with no consequence", () => {
    expect(AskOptionSchema.parse({ id: "opt-1", label: "Postgres" }).consequence).toBeUndefined();
  });

  it("rejects a consequence longer than 280 chars", () => {
    const r = AskOptionSchema.safeParse({ id: "opt-1", label: "x", consequence: "c".repeat(281) });
    expect(r.success).toBe(false);
  });
});

describe("Ask decision-context fields", () => {
  const base = {
    id: "a1",
    projectId: "p1",
    nodeId: "n1",
    type: "DECISION",
    state: "OPEN",
    required: true,
    prompt: "Which db?",
    options: [{ id: "opt-1", label: "Postgres" }],
    chosenOptionId: null,
    assumption: null,
    answerText: null,
    version: 1,
    createdAt: 0,
    updatedAt: 0,
  };

  it("carries rationale (nullable), suggestedAnswers, and agentLabel", () => {
    const ask = AskSchema.parse({
      ...base,
      rationale: "retry-safety",
      suggestedAnswers: [],
      agentLabel: "agent-α",
    });
    expect(ask.rationale).toBe("retry-safety");
    expect(ask.agentLabel).toBe("agent-α");
    expect(ask.suggestedAnswers).toEqual([]);
  });

  it("requires the new fields to be present (no silent drop)", () => {
    expect(AskSchema.safeParse(base).success).toBe(false); // missing rationale/suggestedAnswers/agentLabel
  });

  it("caps rationale at 2000 chars", () => {
    const r = AskSchema.safeParse({
      ...base,
      rationale: "x".repeat(2001),
      suggestedAnswers: [],
      agentLabel: null,
    });
    expect(r.success).toBe(false);
  });
});

describe("park_ask input — backward-compatible options + context", () => {
  const base = { projectId: "p1", nodeId: "n1", prompt: "?", required: true };

  it("accepts bare string options (backward compatible)", () => {
    const v = ParkAskInputSchema.parse({
      ...base,
      type: "DECISION",
      options: ["Postgres", "SQLite"],
    });
    expect(v.options).toHaveLength(2);
  });

  it("accepts { label, consequence } option objects", () => {
    const v = ParkAskInputSchema.parse({
      ...base,
      type: "DECISION",
      options: [
        { label: "Postgres", consequence: "safest" },
        { label: "SQLite", consequence: "no concurrency" },
      ],
    });
    expect(v.options).toHaveLength(2);
  });

  it("still rejects a DECISION with fewer than two options", () => {
    expect(
      ParkAskInputSchema.safeParse({ ...base, type: "DECISION", options: ["only one"] }).success,
    ).toBe(false);
  });

  it("accepts optional rationale, suggestedAnswers, and agentLabel", () => {
    const v = ParkAskInputSchema.parse({
      ...base,
      type: "QUESTION",
      rationale: "need a sampling rate",
      suggestedAnswers: ["100%", "10%"],
      agentLabel: "agent-β",
    });
    expect(v.rationale).toBe("need a sampling rate");
    expect(v.suggestedAnswers).toEqual(["100%", "10%"]);
    expect(v.agentLabel).toBe("agent-β");
  });

  it("caps rationale at 2000 chars at the boundary", () => {
    expect(
      ParkAskInputSchema.safeParse({ ...base, type: "QUESTION", rationale: "x".repeat(2001) })
        .success,
    ).toBe(false);
  });

  it("exposes a raw shape for MCP tool registration", () => {
    // The MCP server registers the tool from the raw shape (refined schemas have no .shape).
    expect(z.object(parkAskInputShape)).toBeDefined;
    expect(Object.keys(parkAskInputShape)).toContain("rationale");
  });
});

describe("InboxItem decision context (optional, degrades gracefully)", () => {
  const base = {
    askId: "a1",
    nodeId: "n1",
    nodeTitle: "Cache layer",
    type: "DECISION",
    state: "OPEN",
    prompt: "?",
    required: true,
    options: [{ id: "opt-1", label: "x", consequence: "y" }],
    blastRadius: 2,
    parkedAt: 0,
    askVersion: 1,
    nodeVersion: 1,
  };

  it("parses with no context fields (older asks)", () => {
    expect(InboxItemSchema.parse(base).rationale).toBeUndefined();
  });

  it("carries rationale, blocks, goalTitle, suggestedAnswers, provenance when present", () => {
    const item = InboxItemSchema.parse({
      ...base,
      rationale: "why",
      blocks: [{ nodeId: "n2", title: "refunds" }],
      goalTitle: "Ship checkout",
      suggestedAnswers: ["a"],
      parkedBy: { agentLabel: "agent-α", at: 10 },
    });
    expect(item.blocks).toEqual([{ nodeId: "n2", title: "refunds" }]);
    expect(item.goalTitle).toBe("Ship checkout");
    expect(item.parkedBy?.agentLabel).toBe("agent-α");
  });
});

describe("AnswerRequest — intent-typed", () => {
  it("accepts a proposal verdict with an adjustment note", () => {
    const r = AnswerRequestSchema.parse({
      expectedVersion: 1,
      proposalVerdict: "adjust",
      adjustmentNote: "keep poller 30d",
    });
    expect(r.proposalVerdict).toBe("adjust");
    expect(r.adjustmentNote).toBe("keep poller 30d");
  });

  it("accepts a bare decision answer (chosenOptionId)", () => {
    expect(
      AnswerRequestSchema.parse({ expectedVersion: 1, chosenOptionId: "opt-1" }).chosenOptionId,
    ).toBe("opt-1");
  });

  it("rejects an unknown proposal verdict", () => {
    expect(
      AnswerRequestSchema.safeParse({ expectedVersion: 1, proposalVerdict: "maybe" }).success,
    ).toBe(false);
  });
});
