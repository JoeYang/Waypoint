// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { WaypointProvider, useWaypoint } from "../wp/WaypointProvider.js";
import { mockSource, type WaypointSource } from "../wp/source.js";
import { Home } from "./Home.js";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

function NavProbe(): React.JSX.Element {
  const { nav } = useWaypoint();
  return <span data-testid="nav">{`${nav.project}/${nav.view}/${nav.decision ?? ""}`}</span>;
}

const renderHome = () =>
  render(
    <WaypointProvider>
      <Home />
      <NavProbe />
    </WaypointProvider>,
  );

describe("Home", () => {
  it("emphasises the count of decisions waiting on you (3 + 1 + 0 = 4)", () => {
    renderHome();
    const bar = screen.getByRole("region", { name: /needs you/i });
    expect(within(bar).getByText("4")).toBeInTheDocument();
    expect(within(bar).getByText(/waiting on you/i)).toBeInTheDocument();
    expect(within(bar).getByText(/Good morning, Joe/)).toBeInTheDocument();
  });

  it("lists the actual parked decisions with a Review button that navigates and opens it", async () => {
    const user = userEvent.setup();
    renderHome();
    const bar = screen.getByRole("region", { name: /needs you/i });
    // a real decision title from the orbit-api fixture (d1)
    expect(within(bar).getByText(/Which ORM should the data layer use\?/)).toBeInTheDocument();
    expect(within(bar).getByText(/parked 12m ago/)).toBeInTheDocument();

    const reviewButtons = within(bar).getAllByRole("button", { name: /Review/ });
    // first decision row is d1 (orbit-api)
    await user.click(reviewButtons[0]!);
    expect(screen.getByTestId("nav")).toHaveTextContent("orbit-api/proposal/d1");
  });

  it("demotes the other metrics into a quiet inline strip", () => {
    renderHome();
    const strip = screen.getByText(/projects ·/);
    // 3 projects · 2 agents working · N tasks in flight · M active streams
    expect(strip).toHaveTextContent(/3 projects/);
    expect(strip).toHaveTextContent(/2 agents working/);
    expect(strip).toHaveTextContent(/tasks in flight/);
    expect(strip).toHaveTextContent(/active streams/);
  });

  it("renders a card per project with the right footer badge", () => {
    renderHome();
    expect(screen.getByText(/3 decisions waiting/)).toBeInTheDocument();
    expect(screen.getByText(/All caught up/)).toBeInTheDocument();
  });

  it("shows a project card's 'Now —' line and segmented progress meter", () => {
    renderHome();
    const card = screen.getByRole("button", { name: /orbit-api/ });
    // current task: the task with here === true ("Seed scripts")
    expect(within(card).getByText(/Now —/)).toBeInTheDocument();
    expect(within(card).getByText(/Seed scripts/)).toBeInTheDocument();
    // segmented meter carries an accessible label with the done/total count
    expect(within(card).getByRole("img", { name: /progress/i })).toBeInTheDocument();
  });

  it("gives a project with an open decision a parked accent", () => {
    renderHome();
    const parked = screen.getByRole("button", { name: /orbit-api/ });
    const caughtUp = screen.getByRole("button", { name: /ledger-svc/ });
    expect(parked).toHaveAttribute("data-parked", "true");
    expect(caughtUp).not.toHaveAttribute("data-parked", "true");
  });

  it("opens the project map when a card is clicked", async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(screen.getByRole("button", { name: /orbit-api/ }));
    expect(screen.getByTestId("nav")).toHaveTextContent("orbit-api/map");
  });

  it("shows the all-caught-up state when there are no open decisions", () => {
    // A source whose projects carry no decisions → the command bar shows its empty state.
    const initial = mockSource.initial();
    if (initial === null) throw new Error("mock source must seed synchronously");
    const cleared = {
      ...initial,
      projects: initial.projects.map((p) => ({ ...p, decisions: [] })),
    };
    const caughtUpSource: WaypointSource = {
      ...mockSource,
      initial: () => cleared,
      load: () => Promise.resolve(cleared),
    };
    render(
      <WaypointProvider source={caughtUpSource}>
        <Home />
      </WaypointProvider>,
    );
    const bar = screen.getByRole("region", { name: /needs you/i });
    expect(within(bar).getByText(/all caught up/i)).toBeInTheDocument();
  });
});
