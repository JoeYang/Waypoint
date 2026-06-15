// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { WaypointProvider, useWaypoint } from "../wp/WaypointProvider.js";
import { NotificationsPanel } from "./NotificationsPanel.js";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

// Surfaces the resulting nav so we can assert where a notification routed to.
function NavProbe(): React.JSX.Element {
  const { nav } = useWaypoint();
  return <span data-testid="nav">{`${nav.project}/${nav.view}/${nav.decision ?? "-"}`}</span>;
}

const renderPanel = (onClose = vi.fn()) => {
  render(
    <WaypointProvider>
      <NotificationsPanel onClose={onClose} />
      <NavProbe />
    </WaypointProvider>,
  );
  return { onClose };
};

describe("NotificationsPanel", () => {
  it("lists notifications in a labelled dialog", () => {
    renderPanel();
    const dialog = screen.getByRole("dialog", { name: "Notifications" });
    expect(within(dialog).getByText(/Which ORM should the data layer use/)).toBeInTheDocument();
    expect(within(dialog).getByText("142 tests passed on the data layer")).toBeInTheDocument();
  });

  it("routes a decision notification to its proposal and closes", async () => {
    const user = userEvent.setup();
    const { onClose } = renderPanel();
    await user.click(screen.getByRole("button", { name: /Which ORM should the data layer use/ }));
    expect(screen.getByTestId("nav")).toHaveTextContent("orbit-api/proposal/d1");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("routes a view notification to that view", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: /142 tests passed/ }));
    expect(screen.getByTestId("nav")).toHaveTextContent("orbit-api/activity/-");
  });

  it("closes when the scrim or Mark all read is used", async () => {
    const user = userEvent.setup();
    const { onClose } = renderPanel();
    await user.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
