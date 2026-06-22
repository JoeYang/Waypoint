// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import type { Digest } from "@waypoint/shared";
import { WaypointProvider } from "../wp/WaypointProvider.js";
import { NAV_KEY } from "../wp/state.js";
import { mockSource, type WaypointSource } from "../wp/source.js";
import { WhileYouWereAway } from "./WhileYouWereAway.js";

afterEach(cleanup);
// Seed nav so a project (orbit-api) is already selected on the spine — the banner's precondition.
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    NAV_KEY,
    JSON.stringify({ project: "orbit-api", view: "map", decision: null }),
  );
});

const renderWith = (source: WaypointSource = mockSource) =>
  render(
    <WaypointProvider source={source}>
      <WhileYouWereAway />
    </WaypointProvider>,
  );

const EMPTY: Digest = {
  projectId: "orbit-api",
  sinceSeq: 9,
  seq: 9,
  shipped: [],
  newlyBlocked: [],
  waiting: [],
  activeWork: [],
  headsUp: [],
  tallies: { done: 0, active: 0, parked: 0, queued: 0 },
};

describe("WhileYouWereAway", () => {
  it("summarizes shipped, newly-blocked, and waiting once a project is selected", async () => {
    renderWith();
    const panel = await screen.findByRole("region", { name: /while you were away/i });
    expect(panel).toHaveTextContent("Wire the spine to live data"); // shipped
    expect(panel).toHaveTextContent("Choose the cache strategy"); // newly blocked + waiting
    expect(panel).toHaveTextContent("blocks 4"); // waiting blast radius
  });

  it("reveals the threaded story on demand, attributed to its actor", async () => {
    const user = userEvent.setup();
    renderWith();
    await screen.findByRole("region", { name: /while you were away/i });
    await user.click(screen.getByRole("button", { name: /view story/i }));
    const story = await screen.findByRole("list", { name: /project story/i });
    expect(story).toHaveTextContent("brave-lark");
    expect(story).toHaveTextContent("Wire the spine to live data");
  });

  it("dismisses (acks the cursor) and hides the banner", async () => {
    const user = userEvent.setup();
    let ackedSeq = -1;
    const source: WaypointSource = {
      ...mockSource,
      ackDigest: (_projectId, seq) => {
        ackedSeq = seq;
        return Promise.resolve();
      },
    };
    renderWith(source);
    await screen.findByRole("region", { name: /while you were away/i });
    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: /while you were away/i }),
      ).not.toBeInTheDocument(),
    );
    expect(ackedSeq).toBe(3); // MOCK_DIGEST.seq
  });

  it("renders nothing when nothing changed since last visit", async () => {
    const source: WaypointSource = { ...mockSource, digest: () => Promise.resolve(EMPTY) };
    renderWith(source);
    // Give the async digest a tick; the empty digest must not produce a banner.
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: /while you were away/i }),
      ).not.toBeInTheDocument(),
    );
  });

  it("shows an error state with a retry when the digest fails to load", async () => {
    let attempts = 0;
    const source: WaypointSource = {
      ...mockSource,
      digest: () => {
        attempts += 1;
        return attempts === 1 ? Promise.reject(new Error("offline")) : Promise.resolve(EMPTY);
      },
    };
    const user = userEvent.setup();
    renderWith(source);
    const alert = await screen.findByRole("alert", { name: /while you were away/i });
    expect(alert).toHaveTextContent(/couldn’t load/i);
    await user.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(attempts).toBe(2));
  });
});
