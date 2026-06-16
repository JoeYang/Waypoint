// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { WaypointProvider } from "../wp/WaypointProvider.js";
import { App } from "../App.js";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const renderApp = () =>
  render(
    <WaypointProvider>
      <App />
    </WaypointProvider>,
  );

describe("App shell", () => {
  it("composes the sidebar, top bar, and a view body", () => {
    renderApp();
    expect(screen.getByRole("button", { name: /Waypoint — all projects/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /orbit-api/ })).toBeInTheDocument();
    expect(screen.getByText("11:24 AM")).toBeInTheDocument();
    // Home has no project selected → the cross-project body placeholder.
    expect(screen.getByText(/All projects — coming in a later slice/)).toBeInTheDocument();
  });

  it("updates the breadcrumb and body when a project + view is chosen", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole("button", { name: /orbit-api/ }));
    expect(screen.getByText(/Project map — coming in a later slice/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Decisions/ }));
    expect(screen.getByText(/Decisions — coming in a later slice/)).toBeInTheDocument();
  });

  it("toggles the notifications popover from the bell", async () => {
    const user = userEvent.setup();
    renderApp();
    expect(screen.queryByRole("dialog", { name: "Notifications" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Notifications/ }));
    expect(screen.getByRole("dialog", { name: "Notifications" })).toBeInTheDocument();
  });
});
