import { describe, it, expect } from "vitest";
import { selectSource, resolveApiBase } from "./select-source.js";
import { mockSource } from "./source.js";

const ORIGIN = "http://localhost:8849";

describe("resolveApiBase", () => {
  it("uses an explicit env base over everything (dev-against-live / e2e / custom deploy)", () => {
    expect(resolveApiBase("http://api.example:9000", false, ORIGIN)).toBe(
      "http://api.example:9000",
    );
    expect(resolveApiBase("http://api.example:9000", true, ORIGIN)).toBe("http://api.example:9000");
  });

  it("defaults a PRODUCTION build to its own origin (the prod container is same-origin live)", () => {
    // Regression: the prod image bundled with no env base must NOT fall back to mock fixtures.
    expect(resolveApiBase(undefined, true, ORIGIN)).toBe(ORIGIN);
    expect(resolveApiBase("  ", true, ORIGIN)).toBe(ORIGIN);
  });

  it("leaves a DEV build on the mock unless a base is given", () => {
    expect(resolveApiBase(undefined, false, ORIGIN)).toBeUndefined();
    expect(resolveApiBase("", false, ORIGIN)).toBeUndefined();
  });

  it("falls back to mock if a prod build somehow has no origin", () => {
    expect(resolveApiBase(undefined, true, undefined)).toBeUndefined();
  });
});

describe("selectSource", () => {
  it("falls back to the mock when no API base is configured", () => {
    expect(selectSource(undefined)).toBe(mockSource);
    expect(selectSource("")).toBe(mockSource);
    expect(selectSource("   ")).toBe(mockSource);
  });

  it("builds a live source when an API base is configured", () => {
    const src = selectSource("http://localhost:8849");
    expect(src).not.toBe(mockSource);
    // The live source has no synchronous seed — the provider shows loading until load() resolves.
    expect(src.initial()).toBeNull();
  });
});
