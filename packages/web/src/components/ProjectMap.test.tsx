// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { WaypointProvider, useWaypoint } from "../wp/WaypointProvider.js";
import { NAV_KEY } from "../wp/state.js";
import { ProjectMap } from "./ProjectMap.js";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

// Seed the provider's persisted nav so it opens on a project's map without a click.
const seedMap = (project: string): void =>
  localStorage.setItem(NAV_KEY, JSON.stringify({ project, view: "map", decision: null }));

// Surfaces nav + a resolve trigger so tests can drive provider actions.
function Probe(): React.JSX.Element {
  const { nav, resolve } = useWaypoint();
  return (
    <>
      <span data-testid="view">{nav.view}</span>
      <button type="button" onClick={() => resolve("d1", "Drizzle")}>
        resolve-d1
      </button>
    </>
  );
}

const renderMap = () =>
  render(
    <WaypointProvider>
      <ProjectMap />
      <Probe />
    </WaypointProvider>,
  );

describe("ProjectMap", () => {
  it("renders a lane per stream with its progress", () => {
    seedMap("orbit-api");
    renderMap();
    // orbit-api has five streams; check a couple of lane heads and a progress count.
    expect(screen.getByText("Data layer")).toBeInTheDocument();
    expect(screen.getByText("API routes")).toBeInTheDocument();
    // Auth: 2/2 done.
    expect(screen.getByText("2/2 done")).toBeInTheDocument();
  });

  it("shows the legend", () => {
    seedMap("orbit-api");
    renderMap();
    const legend = within(screen.getByRole("group", { name: /legend/i }));
    expect(legend.getByText("Done")).toBeInTheDocument();
    expect(legend.getByText("Queued")).toBeInTheDocument();
  });

  it("opens the proposal when a blocked task node is clicked", async () => {
    const user = userEvent.setup();
    seedMap("orbit-api");
    renderMap();
    expect(screen.getByTestId("view")).toHaveTextContent("map");
    await user.click(screen.getByRole("button", { name: /Choose ORM/ }));
    expect(screen.getByTestId("view")).toHaveTextContent("proposal");
  });

  it("flips a resolved blocked node to 'resolved → resuming'", async () => {
    const user = userEvent.setup();
    seedMap("orbit-api");
    renderMap();
    // d1 (Choose ORM) starts as a clickable parked node.
    expect(screen.getByRole("button", { name: /Choose ORM/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "resolve-d1" }));
    expect(screen.getByText(/resolved → resuming/)).toBeInTheDocument();
    // It is no longer interactive once resolved.
    expect(screen.queryByRole("button", { name: /Choose ORM/ })).not.toBeInTheDocument();
  });

  it("renders an empty state when the nav points at no project", () => {
    // No seed → provider stays on home (project null) → map has nothing to show.
    renderMap();
    expect(screen.getByText(/No project selected/i)).toBeInTheDocument();
  });
});
