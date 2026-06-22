import { describe, it, expect } from "vitest";
import {
  REENTRY_DIR_KEY,
  loadDirection,
  saveDirection,
  type ReentryDirection,
} from "./reentryPref.js";

// A minimal in-memory storage stand-in so the helper is tested without jsdom / window.
function memStorage(seed?: Record<string, string>): Pick<Storage, "getItem" | "setItem"> {
  const map = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

// A storage whose access always throws (private mode / quota / disabled) — load must fall back and
// save must be a silent no-op, never propagating the throw.
const throwingStorage: Pick<Storage, "getItem" | "setItem"> = {
  getItem: () => {
    throw new Error("storage unavailable");
  },
  setItem: () => {
    throw new Error("storage unavailable");
  },
};

describe("reentryPref", () => {
  it("defaults to briefing when nothing is stored", () => {
    expect(loadDirection(memStorage())).toBe("briefing");
  });

  it("defaults to briefing when storage is undefined", () => {
    expect(loadDirection(undefined)).toBe("briefing");
  });

  it("round-trips a saved direction", () => {
    const storage = memStorage();
    for (const dir of ["briefing", "mission", "timeline"] as const) {
      saveDirection(storage, dir);
      expect(loadDirection(storage)).toBe(dir);
    }
  });

  it("persists under the documented key", () => {
    const storage = memStorage();
    saveDirection(storage, "timeline");
    expect(storage.getItem(REENTRY_DIR_KEY)).toBe("timeline");
  });

  it("falls back to the default for an unknown stored value", () => {
    expect(loadDirection(memStorage({ [REENTRY_DIR_KEY]: "kanban" }))).toBe("briefing");
  });

  it("falls back to the default for an empty stored value", () => {
    expect(loadDirection(memStorage({ [REENTRY_DIR_KEY]: "" }))).toBe("briefing");
  });

  it("degrades to the default when reading storage throws", () => {
    expect(loadDirection(throwingStorage)).toBe("briefing");
  });

  it("is a no-op (never throws) when writing storage throws", () => {
    const dir: ReentryDirection = "mission";
    expect(() => saveDirection(throwingStorage, dir)).not.toThrow();
  });
});
