import { describe, it, expect } from "vitest";
import type { InboxItem, InboxResponse, WsDelta } from "@waypoint/shared";
import {
  applyFrame,
  applySnapshot,
  initialInboxState,
  rankInbox,
  type InboxState,
} from "./reducer.js";

const item = (askId: string, over: Partial<InboxItem> = {}): InboxItem => ({
  askId,
  nodeId: `node-${askId}`,
  nodeTitle: `Node ${askId}`,
  type: "QUESTION",
  state: "OPEN",
  prompt: `prompt ${askId}`,
  required: true,
  options: [],
  blastRadius: 0,
  parkedAt: 1000,
  askVersion: 1,
  nodeVersion: 1,
  risk: "medium",
  reversible: true,
  ...over,
});

const delta = (seq: number, over: Partial<WsDelta> = {}): WsDelta => ({
  type: "delta",
  seq,
  upserts: [],
  removedAskIds: [],
  ...over,
});

describe("inbox reducer", () => {
  it("applies a delta's upserts and removals and advances seq", () => {
    let state = applyFrame(initialInboxState, delta(2, { upserts: [item("a"), item("b")] }));
    expect(Object.keys(state.itemsById)).toEqual(["a", "b"]);
    expect(state.seq).toBe(2);

    state = applyFrame(state, delta(3, { upserts: [item("c")], removedAskIds: ["a"] }));
    expect(Object.keys(state.itemsById).sort()).toEqual(["b", "c"]);
    expect(state.seq).toBe(3);
  });

  it("ignores a delta whose seq is not newer (idempotent replay)", () => {
    const d = delta(2, { upserts: [item("a")] });
    const once = applyFrame(initialInboxState, d);
    const twice = applyFrame(once, d); // same frame replayed
    expect(twice).toBe(once); // unchanged reference — true no-op
    // An older seq is also ignored, even if it carries a removal.
    const older = applyFrame(once, delta(1, { removedAskIds: ["a"] }));
    expect(older.itemsById.a).toBeDefined();
  });

  it("advances seq on an empty delta (keeps the resume pointer moving)", () => {
    const state = applyFrame(applyFrame(initialInboxState, delta(2)), delta(5));
    expect(state.seq).toBe(5);
  });

  it("resets to empty state on a resync frame", () => {
    const populated: InboxState = applyFrame(initialInboxState, delta(9, { upserts: [item("a")] }));
    const resynced = applyFrame(populated, { type: "resync", reason: "gap" });
    expect(resynced).toEqual(initialInboxState);
  });

  it("ranks by blast radius desc, ties broken by oldest parkedAt", () => {
    const state = applyFrame(
      initialInboxState,
      delta(4, {
        upserts: [
          item("low", { blastRadius: 0, parkedAt: 10 }),
          item("tieNew", { blastRadius: 5, parkedAt: 30 }),
          item("tieOld", { blastRadius: 5, parkedAt: 20 }),
        ],
      }),
    );
    expect(rankInbox(state).map((i) => i.askId)).toEqual(["tieOld", "tieNew", "low"]);
  });

  it("seeds initial state from a REST InboxResponse snapshot", () => {
    const resp: InboxResponse = { projectId: "default", seq: 7, items: [item("a"), item("b")] };
    const state = applySnapshot(initialInboxState, resp);
    expect(state.seq).toBe(7);
    expect(
      rankInbox(state)
        .map((i) => i.askId)
        .sort(),
    ).toEqual(["a", "b"]);
  });
});
