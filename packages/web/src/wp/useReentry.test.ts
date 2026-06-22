// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { renderHook, cleanup, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import type { Digest } from "@waypoint/shared";
import { WaypointProvider } from "./WaypointProvider.js";
import { mockSource, type WaypointSource } from "./source.js";
import { useReentry } from "./useReentry.js";

afterEach(cleanup);

const wrapperFor =
  (source: WaypointSource) =>
  ({ children }: { children: ReactNode }) =>
    createElement(WaypointProvider, { source, children });

// orbit-api is the project in the mock fixtures; its first open decision is "d1".
const PROJECT = "orbit-api";

// A digest whose waiting entry's askId matches a real project decision (d1) and is new — so the
// mapped needsYou item for d1 should carry isNew === true.
const digestMarkingD1New = (base: Digest): Digest => ({
  ...base,
  waiting: [
    {
      askId: "d1",
      nodeId: "n-d1",
      nodeTitle: "Which ORM should the data layer use?",
      type: "DECISION",
      prompt: "Prisma, Drizzle, or Knex?",
      blastRadius: 5,
      ageMs: 12 * 60 * 1000,
      risk: "medium",
      reversible: true,
      isNew: true,
    },
  ],
});

describe("useReentry", () => {
  it("starts loading, then maps the digest + story + decisions into a ready model", async () => {
    const { result } = renderHook(() => useReentry(PROJECT), {
      wrapper: wrapperFor(mockSource),
    });

    expect(result.current.status).toBe("loading");

    await waitFor(() => expect(result.current.status).toBe("ready"));
    if (result.current.status !== "ready") throw new Error("expected ready");
    const m = result.current.model;

    expect(m.greeting.projectName).toBe("orbit-api");
    expect(m.greeting.userName).toBe("Joe Yang");
    // The project's open decisions become needsYou.
    expect(m.needsYou.length).toBeGreaterThan(0);
    expect(m.needsYou.map((d) => d.id)).toContain("d1");
    // activeWork / moved / headsUp / tallies / seq come straight from the digest.
    expect(m.activeWork[0]?.nodeTitle).toBe("Seed scripts");
    expect(m.moved[0]?.title).toBe("Wire the spine to live data");
    expect(m.headsUp[0]?.prompt).toBe("Redis or in-process?");
    expect(m.tallies.done).toBe(4);
    expect(m.seq).toBe(3);
    // The story is threaded into the model oldest-first, alongside the digest cursor.
    expect(m.timeline.map((e) => e.nodeTitle)).toEqual([
      "Wire the spine to live data",
      "Choose the cache strategy",
    ]);
    expect(m.timeline[0]?.seq).toBe(1);
    expect(m.sinceSeq).toBe(0);
  });

  it("marks a needsYou decision new when a matching waiting entry is new", async () => {
    const source: WaypointSource = {
      ...mockSource,
      digest: () => mockSource.digest(PROJECT).then((d) => digestMarkingD1New(d)),
    };
    const { result } = renderHook(() => useReentry(PROJECT), {
      wrapper: wrapperFor(source),
    });

    await waitFor(() => expect(result.current.status).toBe("ready"));
    if (result.current.status !== "ready") throw new Error("expected ready");

    const d1 = result.current.model.needsYou.find((d) => d.id === "d1");
    expect(d1?.isNew).toBe(true);
  });

  it("enters the error state with a working retry when the digest rejects", async () => {
    let attempts = 0;
    const source: WaypointSource = {
      ...mockSource,
      digest: () => {
        attempts += 1;
        return attempts === 1 ? Promise.reject(new Error("offline")) : mockSource.digest(PROJECT);
      },
    };
    const { result } = renderHook(() => useReentry(PROJECT), {
      wrapper: wrapperFor(source),
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    const errored = result.current;
    if (errored.status !== "error") throw new Error("expected error");

    act(() => errored.retry());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(attempts).toBe(2);
  });
});
