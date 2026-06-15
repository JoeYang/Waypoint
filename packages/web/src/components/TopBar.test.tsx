// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { WaypointProvider, useWaypoint } from "../wp/WaypointProvider.js";
import { TopBar } from "./TopBar.js";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

// Helper to drive the provider into a project view before asserting on the crumb.
function Selecter(): React.JSX.Element {
  const { navigate } = useWaypoint();
  return <button onClick={() => navigate({ project: "orbit-api", view: "inbox" })}>select</button>;
}

const renderTopBar = (onBell = vi.fn()) => {
  render(
    <WaypointProvider>
      <TopBar onBell={onBell} />
      <Selecter />
    </WaypointProvider>,
  );
  return { onBell };
};

describe("TopBar", () => {
  it("shows 'All projects' and the clock when no project is selected", () => {
    renderTopBar();
    expect(screen.getByText("All projects")).toBeInTheDocument();
    expect(screen.getByText("11:24 AM")).toBeInTheDocument();
  });

  it("shows the breadcrumb and agent pill once a project is selected", async () => {
    const user = userEvent.setup();
    renderTopBar();
    await user.click(screen.getByRole("button", { name: "select" }));
    expect(screen.getByText("orbit-api")).toBeInTheDocument();
    expect(screen.getByText("Decisions")).toBeInTheDocument();
    expect(screen.getByText(/Agent working/)).toBeInTheDocument();
  });

  it("labels the bell with the unread count and fires onBell", async () => {
    const user = userEvent.setup();
    const { onBell } = renderTopBar();
    // Two notifications are unread in the fixture.
    const bell = screen.getByRole("button", { name: /Notifications, 2 unread/ });
    await user.click(bell);
    expect(onBell).toHaveBeenCalledOnce();
  });
});
