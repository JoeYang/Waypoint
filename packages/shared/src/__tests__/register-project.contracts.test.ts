import { describe, it, expect } from "vitest";
import { RegisterProjectInputSchema, RegisterProjectResultSchema } from "../mcp.js";

describe("register_project contract", () => {
  it("accepts a valid slug projectId + name", () => {
    const r = RegisterProjectInputSchema.safeParse({ projectId: "trading-universe_2", name: "Trading Universe" });
    expect(r.success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(RegisterProjectInputSchema.safeParse({ projectId: "p", name: "" }).success).toBe(false);
  });

  it("rejects an empty projectId", () => {
    expect(RegisterProjectInputSchema.safeParse({ projectId: "", name: "X" }).success).toBe(false);
  });

  it("rejects a non-slug projectId (spaces / punctuation)", () => {
    expect(RegisterProjectInputSchema.safeParse({ projectId: "bad id!", name: "X" }).success).toBe(false);
  });

  it("rejects an oversized name", () => {
    expect(
      RegisterProjectInputSchema.safeParse({ projectId: "p", name: "x".repeat(121) }).success,
    ).toBe(false);
  });

  it("result carries id, name, created", () => {
    const r = RegisterProjectResultSchema.safeParse({ id: "p", name: "P", created: true });
    expect(r.success).toBe(true);
  });
});
