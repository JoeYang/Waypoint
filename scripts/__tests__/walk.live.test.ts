import { describe, it, expect } from "vitest";
import { runWalk } from "../walk.ts";

// Thin Vitest wrapper around the standalone full-surface walk, for CI reporting + retries.
// Requires a running stack (the orchestrator provisions it). Run via:
//   npm run walk:ci      (vitest run --config vitest.walk.config.ts)
// The walk asserts its own contract internally and throws on any gap; here we additionally
// pin the covered-surface count so a silently shrunk walk fails the suite.
describe("full-surface walk (live wire)", () => {
  it("exercises every external surface against the running stack", async () => {
    const result = await runWalk();
    expect(result.covered.length).toBeGreaterThanOrEqual(27);
  }, 60_000);
});
