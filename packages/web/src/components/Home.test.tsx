// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { WaypointProvider, useWaypoint } from "../wp/WaypointProvider.js";
import { Home } from "./Home.js";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

function NavProbe(): React.JSX.Element {
  const { nav } = useWaypoint();
  return <span data-testid="nav">{`${nav.project}/${nav.view}`}</span>;
}

const renderHome = () =>
  render(
    <WaypointProvider>
      <Home />
      <NavProbe />
    </WaypointProvider>,
  );

describe("Home", () => {
  it("greets with the count of parked decisions (3 + 1 + 0 = 4)", () => {
    renderHome();
    expect(screen.getByText(/Good morning, Joe — it's 11:24/)).toBeInTheDocument();
    expect(screen.getByText(/parked 4 decisions/)).toBeInTheDocument();
  });

  it("shows the four summary stats", () => {
    renderHome();
    expect(screen.getByText("Decisions waiting on you")).toBeInTheDocument();
    expect(screen.getByText("Agents working now")).toBeInTheDocument();
    expect(screen.getByText("Tasks in flight")).toBeInTheDocument();
    expect(screen.getByText("Active work streams")).toBeInTheDocument();
  });

  it("renders a card per project with the right footer badge", () => {
    renderHome();
    // orbit-api has 3 decisions waiting; ledger-svc is caught up.
    expect(screen.getByText(/3 decisions waiting/)).toBeInTheDocument();
    expect(screen.getByText(/All caught up/)).toBeInTheDocument();
  });

  it("opens the project map when a card is clicked", async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(screen.getByRole("button", { name: /orbit-api/ }));
    expect(screen.getByTestId("nav")).toHaveTextContent("orbit-api/map");
  });

  it("dismisses the briefing", async () => {
    const user = userEvent.setup();
    renderHome();
    expect(screen.getByText(/Good morning/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Dismiss briefing/ }));
    expect(screen.queryByText(/Good morning/)).not.toBeInTheDocument();
  });
});
