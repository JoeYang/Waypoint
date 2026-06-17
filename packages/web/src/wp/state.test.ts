import { describe, it, expect } from "vitest";
import {
  reducer,
  initialState,
  HOME_NAV,
  NAV_KEY,
  loadNav,
  saveNav,
  safeNav,
  type WaypointState,
} from "./state.js";
import { WP_DATA } from "./fixtures.js";

const base = (): WaypointState => initialState();

describe("nav reducer", () => {
  it("navigate replaces nav, defaulting view to map", () => {
    const s = reducer(base(), { type: "navigate", to: { project: "orbit-api" } });
    expect(s.nav).toEqual({ project: "orbit-api", view: "map", decision: null });
  });

  it("navigate honours an explicit view", () => {
    const s = reducer(base(), { type: "navigate", to: { project: "orbit-api", view: "activity" } });
    expect(s.nav.view).toBe("activity");
  });

  it("goHome resets to the cross-project home", () => {
    const started = reducer(base(), {
      type: "navigate",
      to: { project: "orbit-api", view: "settings" },
    });
    expect(reducer(started, { type: "goHome" }).nav).toEqual(HOME_NAV);
  });

  it("openDecision opens the proposal and keeps the project", () => {
    const started = reducer(base(), {
      type: "navigate",
      to: { project: "orbit-api", view: "inbox" },
    });
    const s = reducer(started, { type: "openDecision", id: "d1" });
    expect(s.nav).toEqual({ project: "orbit-api", view: "proposal", decision: "d1" });
  });
});

describe("resolve / comment reducers", () => {
  it("resolve records the option and threads an agent resume message", () => {
    const s = reducer(base(), {
      type: "resolve",
      id: "d1",
      option: "Drizzle",
      blocksTask: "Choose ORM",
    });
    expect(s.resolved["d1"]).toEqual({ option: "Drizzle" });
    const thread = s.threads["d1"] ?? [];
    expect(thread).toHaveLength(1);
    expect(thread[0]?.who).toBe("agent");
    expect(thread[0]?.text).toContain("Applied Drizzle");
    expect(thread[0]?.text).toContain("Choose ORM");
  });

  it("resolve is a no-op once a decision is already resolved", () => {
    const once = reducer(base(), {
      type: "resolve",
      id: "d1",
      option: "Drizzle",
      blocksTask: "Choose ORM",
    });
    const twice = reducer(once, {
      type: "resolve",
      id: "d1",
      option: "Prisma",
      blocksTask: "Choose ORM",
    });
    expect(twice).toBe(once);
    expect(twice.resolved["d1"]).toEqual({ option: "Drizzle" });
  });

  it("comment threads the human message then an agent reply, without resolving", () => {
    const s = reducer(base(), { type: "comment", id: "d1", text: "What about migrations?" });
    const thread = s.threads["d1"] ?? [];
    expect(thread.map((m) => m.who)).toEqual(["you", "agent"]);
    expect(thread[0]?.text).toBe("What about migrations?");
    expect(s.resolved["d1"]).toBeUndefined();
  });
});

// A fake Storage so these pure-logic tests need no DOM (the suite runs in the node env).
const makeStorage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};

describe("loadNav / saveNav", () => {
  it("returns HOME_NAV when storage is empty", () => {
    expect(loadNav(makeStorage())).toEqual(HOME_NAV);
  });

  it("round-trips a valid nav", () => {
    const storage = makeStorage();
    const nav = { project: "orbit-api", view: "inbox" as const, decision: null };
    saveNav(storage, nav);
    expect(loadNav(storage)).toEqual(nav);
  });

  it("falls back to HOME_NAV on unparseable JSON", () => {
    const storage = makeStorage();
    storage.setItem(NAV_KEY, "{not json");
    expect(loadNav(storage)).toEqual(HOME_NAV);
  });

  it("falls back to HOME_NAV on a wrong-shaped object", () => {
    const storage = makeStorage();
    storage.setItem(NAV_KEY, JSON.stringify({ project: 5, view: "nope" }));
    expect(loadNav(storage)).toEqual(HOME_NAV);
  });

  it("does not throw when storage is undefined", () => {
    expect(() => saveNav(undefined, HOME_NAV)).not.toThrow();
    expect(loadNav(undefined)).toEqual(HOME_NAV);
  });
});

describe("safeNav", () => {
  it("sends a null project to home", () => {
    expect(safeNav({ project: null, view: "map", decision: null }, WP_DATA)).toEqual(HOME_NAV);
  });

  it("sends an unknown project to home", () => {
    expect(safeNav({ project: "ghost", view: "map", decision: null }, WP_DATA)).toEqual(HOME_NAV);
  });

  it("falls back a proposal with a missing decision to the project inbox", () => {
    const fixed = safeNav({ project: "orbit-api", view: "proposal", decision: "ghost" }, WP_DATA);
    expect(fixed).toEqual({ project: "orbit-api", view: "inbox", decision: null });
  });

  it("leaves a valid nav untouched", () => {
    const nav = { project: "orbit-api", view: "proposal" as const, decision: "d1" };
    expect(safeNav(nav, WP_DATA)).toEqual(nav);
  });
});

describe("prune (reconcile optimistic state with live data)", () => {
  const resolvedState = (): WaypointState => {
    const s = reducer(base(), { type: "resolve", id: "d1", option: "X", blocksTask: "T" });
    return reducer(s, { type: "resolve", id: "d2", option: "Y", blocksTask: "U" });
  };

  it("drops resolved/thread entries whose decision is gone from live data", () => {
    const pruned = reducer(resolvedState(), { type: "prune", validIds: ["d1"] });
    expect(pruned.resolved).toHaveProperty("d1");
    expect(pruned.resolved).not.toHaveProperty("d2");
    expect(pruned.threads).not.toHaveProperty("d2");
  });

  it("is identity-stable when nothing needs pruning", () => {
    const s = resolvedState();
    expect(reducer(s, { type: "prune", validIds: ["d1", "d2"] })).toBe(s);
  });
});
