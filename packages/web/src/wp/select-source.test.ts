import { describe, it, expect } from "vitest";
import { selectSource } from "./select-source.js";
import { mockSource } from "./source.js";

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
