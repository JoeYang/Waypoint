// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { WaypointProvider } from "../wp/WaypointProvider.js";
import { mockSource, type WaypointSource } from "../wp/source.js";
import { REENTRY_DIR_KEY, loadDirection } from "../wp/reentryPref.js";
import { ReentrySurface } from "./ReentrySurface.js";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

// orbit-api is the mock project; MOCK_DIGEST has shipped + open decisions, so the surface
// auto-opens with content present.
const PROJECT = "orbit-api";

const renderWith = (source: WaypointSource = mockSource) =>
  render(
    <WaypointProvider source={source}>
      <ReentrySurface projectId={PROJECT} />
    </WaypointProvider>,
  );

// The three radio options, queried by their accessible names within the switcher.
const switcher = () => screen.getByRole("radiogroup", { name: /re-entry view/i });
const option = (name: RegExp) => within(switcher()).getByRole("radio", { name });

describe("ReentrySurface", () => {
  it("renders the switcher with all three options, briefing selected by default", async () => {
    renderWith();
    await waitFor(() => expect(switcher()).toBeInTheDocument());
    expect(option(/briefing/i)).toBeChecked();
    expect(option(/mission control/i)).toBeInTheDocument();
    expect(option(/timeline/i)).toBeInTheDocument();
  });

  it("auto-opens the default briefing surface when there is content", async () => {
    renderWith();
    // The Briefing surface is a dialog labelled "While you were away"; its greeting is distinctive.
    const dialog = await screen.findByRole("dialog", { name: /while you were away/i });
    expect(await within(dialog).findByText(/welcome back/i)).toBeVisible();
  });

  it("closes the surface and reopens it from the trigger", async () => {
    const user = userEvent.setup();
    renderWith();
    await screen.findByRole("dialog", { name: /while you were away/i });

    // Briefing's primary action ("Jump into the session") closes it.
    await user.click(screen.getByRole("button", { name: /jump into the session/i }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: /while you were away/i }),
      ).not.toBeInTheDocument(),
    );

    // The trigger reopens it.
    await user.click(screen.getByRole("button", { name: /while you were away/i }));
    expect(await screen.findByRole("dialog", { name: /while you were away/i })).toBeInTheDocument();
  });

  it("switches to timeline then mission control, persisting each choice and swapping live", async () => {
    const user = userEvent.setup();
    renderWith();
    await screen.findByRole("dialog", { name: /while you were away/i });

    // Select Timeline: it persists and the timeline drawer (its "Session replay" head) renders.
    await user.click(option(/timeline/i));
    expect(loadDirection(localStorage)).toBe("timeline");
    expect(await screen.findByText(/session replay/i)).toBeVisible();

    // Select Mission control: persists and the mission-control deck ("Skip to session") renders.
    await user.click(option(/mission control/i));
    expect(loadDirection(localStorage)).toBe("mission");
    expect(await screen.findByRole("button", { name: /skip to session/i })).toBeVisible();
  });

  it("restores the persisted choice on a fresh mount", async () => {
    localStorage.setItem(REENTRY_DIR_KEY, "timeline");
    renderWith();
    await waitFor(() => expect(switcher()).toBeInTheDocument());
    expect(option(/timeline/i)).toBeChecked();
    // The timeline surface (not the briefing) auto-opens.
    expect(await screen.findByText(/session replay/i)).toBeVisible();
  });

  it("renders the switcher without crashing while data is loading (no surface forced open)", async () => {
    const source: WaypointSource = { ...mockSource, digest: () => new Promise<never>(() => {}) };
    renderWith(source);
    await waitFor(() => expect(switcher()).toBeInTheDocument());
    // Loading: no surface auto-opens, but the trigger is available.
    expect(screen.queryByRole("dialog", { name: /while you were away/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /while you were away/i })).toBeInTheDocument();
  });

  it("renders the switcher without crashing when the digest fails", async () => {
    const source: WaypointSource = {
      ...mockSource,
      digest: () => Promise.reject(new Error("offline")),
    };
    renderWith(source);
    await waitFor(() => expect(switcher()).toBeInTheDocument());
    expect(screen.queryByRole("dialog", { name: /while you were away/i })).not.toBeInTheDocument();
  });
});
