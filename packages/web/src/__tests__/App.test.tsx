// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { WaypointProvider } from "../wp/WaypointProvider.js";
import { App } from "../App.js";

// "orbit-api" appears in both the sidebar and Home's project cards, so sidebar queries are
// scoped to the complementary (aside) region.
const sidebar = () => within(screen.getByRole("complementary"));

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const renderApp = () =>
  render(
    <WaypointProvider>
      <App />
    </WaypointProvider>,
  );

describe("App shell", () => {
  it("composes the sidebar, top bar, and the Home screen", () => {
    renderApp();
    expect(sidebar().getByRole("button", { name: /Waypoint — all projects/ })).toBeInTheDocument();
    expect(sidebar().getByRole("button", { name: /orbit-api/ })).toBeInTheDocument();
    expect(screen.getByText("11:24 AM")).toBeInTheDocument();
    // Home has no project selected → the cross-project Home screen renders.
    expect(screen.getByRole("region", { name: /needs you/i })).toBeInTheDocument();
  });

  it("updates the breadcrumb and body when a project + view is chosen", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(sidebar().getByRole("button", { name: /orbit-api/ }));
    expect(screen.getByRole("heading", { name: "Project map" })).toBeInTheDocument();
    await user.click(sidebar().getByRole("button", { name: /Decisions/ }));
    expect(screen.getByRole("heading", { name: /waiting/ })).toBeInTheDocument();
  });

  it("toggles the notifications popover from the bell", async () => {
    const user = userEvent.setup();
    renderApp();
    expect(screen.queryByRole("dialog", { name: "Notifications" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Notifications/ }));
    expect(screen.getByRole("dialog", { name: "Notifications" })).toBeInTheDocument();
  });
});
