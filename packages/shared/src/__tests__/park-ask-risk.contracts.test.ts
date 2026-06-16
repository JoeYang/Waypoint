import { describe, it, expect } from "vitest";
import { ParkAskInputSchema, parkAskInputShape } from "../mcp.js";
import { Risk, RISK_LEVELS } from "../ask.js";

const base = {
  projectId: "p1",
  nodeId: "n1",
  type: "DECISION" as const,
  prompt: "Which store?",
  required: true,
  options: ["Postgres", "SQLite"],
};

describe("park_ask risk + reversibility (agent-supplied)", () => {
  it("accepts an agent-declared risk and reversibility", () => {
    const v = ParkAskInputSchema.parse({ ...base, risk: "high", reversible: false });
    expect(v.risk).toBe("high");
    expect(v.reversible).toBe(false);
  });

  it("is backward-compatible — both are optional", () => {
    const v = ParkAskInputSchema.parse(base);
    expect(v.risk).toBeUndefined();
    expect(v.reversible).toBeUndefined();
  });

  it("rejects a risk outside low|medium|high", () => {
    expect(ParkAskInputSchema.safeParse({ ...base, risk: "critical" }).success).toBe(false);
  });

  it("exposes the new fields on the raw input shape (for MCP tool registration)", () => {
    expect(Object.keys(parkAskInputShape)).toEqual(expect.arrayContaining(["risk", "reversible"]));
  });

  it("Risk enum carries exactly low|medium|high", () => {
    expect(RISK_LEVELS).toEqual(["low", "medium", "high"]);
    expect(Risk.options).toEqual(["low", "medium", "high"]);
  });
});
