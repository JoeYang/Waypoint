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
    // API routes: 0/4 done (an expanded lane shows the "X/Y done" meta).
    expect(screen.getByText("0/4 done")).toBeInTheDocument();
  });

  it("shows the legend", () => {
    seedMap("orbit-api");
    renderMap();
    const legend = within(screen.getByRole("group", { name: /legend/i }));
    expect(legend.getByText("Done")).toBeInTheDocument();
    expect(legend.getByText("Queued")).toBeInTheDocument();
  });

  it("surfaces the parked decision question on the map node", () => {
    seedMap("orbit-api");
    renderMap();
    // d1's question is resolved from project.decisions and rendered on the parked node.
    expect(screen.getByText(/Which ORM should the data layer use\?/)).toBeInTheDocument();
  });

  it("opens the proposal when a blocked task node is clicked", async () => {
    const user = userEvent.setup();
    seedMap("orbit-api");
    renderMap();
    expect(screen.getByTestId("view")).toHaveTextContent("map");
    // The parked node's accessible name now carries the decision question.
    await user.click(screen.getByRole("button", { name: /Which ORM should the data layer use\?/ }));
    expect(screen.getByTestId("view")).toHaveTextContent("proposal");
  });

  it("flips a resolved blocked node to 'resolved → resuming'", async () => {
    const user = userEvent.setup();
    seedMap("orbit-api");
    renderMap();
    // d1 (Choose ORM) starts as a clickable parked node, named by its question.
    expect(
      screen.getByRole("button", { name: /Which ORM should the data layer use\?/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "resolve-d1" }));
    expect(screen.getByText(/resolved → resuming/)).toBeInTheDocument();
    // It is no longer interactive once resolved.
    expect(
      screen.queryByRole("button", { name: /Which ORM should the data layer use\?/ }),
    ).not.toBeInTheDocument();
  });

  it("collapses a done lane by default — its task nodes are hidden", () => {
    seedMap("orbit-api");
    renderMap();
    // The "Auth" stream is status: "done" (2/2). Its header stays visible…
    const auth = screen.getByRole("button", { name: /Auth/ });
    expect(auth).toHaveAttribute("aria-expanded", "false");
    // A collapsed done lane reads as complete via the "all green" summary, not "X/Y done".
    expect(within(auth).getByText(/2\/2 · all green/)).toBeInTheDocument();
    // …but its task nodes are not rendered while collapsed.
    expect(screen.queryByText("Auth middleware")).not.toBeInTheDocument();
    expect(screen.queryByText("Token rotation")).not.toBeInTheDocument();
  });

  it("expands a done lane when its header is activated", async () => {
    const user = userEvent.setup();
    seedMap("orbit-api");
    renderMap();
    const auth = screen.getByRole("button", { name: /Auth/ });
    await user.click(auth);
    expect(auth).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Auth middleware")).toBeInTheDocument();
    expect(screen.getByText("Token rotation")).toBeInTheDocument();
  });

  it("leaves a non-done lane expanded — its task nodes are visible by default", () => {
    seedMap("orbit-api");
    renderMap();
    // "Data layer" is status: "active"; its header is an expanded toggle and its tasks show.
    const dataLayer = screen.getByRole("button", { name: /Data layer/ });
    expect(dataLayer).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Schema migration")).toBeInTheDocument();
    expect(screen.getByText("Seed scripts")).toBeInTheDocument();
  });

  it("renders an empty state when the nav points at no project", () => {
    // No seed → provider stays on home (project null) → map has nothing to show.
    renderMap();
    expect(screen.getByText(/No project selected/i)).toBeInTheDocument();
  });

  it("shows a summary strip with stream, live-edit, and parked counts", () => {
    seedMap("orbit-api");
    renderMap();
    // orbit-api: 5 streams; active tasks (Seed scripts, Resource routes, Dockerfile) = 3 live
    // edits; blocked tasks (Choose ORM, Session store) = 2 parked.
    const strip = screen.getByRole("group", { name: /map summary/i });
    expect(strip).toHaveTextContent(/5\s*streams/);
    expect(strip).toHaveTextContent(/3\s*live edits/);
    expect(strip).toHaveTextContent(/2\s*parked/);
  });

  it("exposes a progress meter on each lane header with the right value", () => {
    seedMap("orbit-api");
    renderMap();
    // Auth is 2/2 done → aria-valuenow 2, max 2.
    const auth = screen.getByRole("progressbar", { name: /Auth progress/i });
    expect(auth).toHaveAttribute("aria-valuenow", "2");
    expect(auth).toHaveAttribute("aria-valuemin", "0");
    expect(auth).toHaveAttribute("aria-valuemax", "2");
    // Data layer is 1/3 done.
    const data = screen.getByRole("progressbar", { name: /Data layer progress/i });
    expect(data).toHaveAttribute("aria-valuenow", "1");
    expect(data).toHaveAttribute("aria-valuemax", "3");
  });

  it("shows an 'all green' summary on a collapsed done lane", () => {
    seedMap("orbit-api");
    renderMap();
    // Auth (done, 2/2) starts collapsed → its header carries the all-green summary.
    const auth = screen.getByRole("button", { name: /Auth/ });
    expect(auth).toHaveAttribute("aria-expanded", "false");
    expect(within(auth).getByText(/all green/i)).toBeInTheDocument();
    expect(within(auth).getByText(/2\/2/)).toBeInTheDocument();
  });

  it("offers a 'Jump to where you left off' button that expands the here task's lane", async () => {
    const user = userEvent.setup();
    seedMap("orbit-api");
    renderMap();
    // The here task ("Seed scripts") lives in the Data layer lane.
    const jump = screen.getByRole("button", { name: /jump to where you left off/i });
    await user.click(jump);
    const dataLayer = screen.getByRole("button", { name: /Data layer/ });
    expect(dataLayer).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Seed scripts")).toBeInTheDocument();
  });
});
