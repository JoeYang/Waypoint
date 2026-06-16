// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { WaypointProvider } from "../wp/WaypointProvider.js";
import { Sidebar } from "./Sidebar.js";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const renderSidebar = (onOpenMobile = vi.fn()) => {
  render(
    <WaypointProvider>
      <Sidebar onOpenMobile={onOpenMobile} />
    </WaypointProvider>,
  );
  return { onOpenMobile };
};

describe("Sidebar", () => {
  it("lists every project and the home brand", () => {
    renderSidebar();
    expect(screen.getByRole("button", { name: /Waypoint — all projects/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /orbit-api/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /atlas-web/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ledger-svc/ })).toBeInTheDocument();
  });

  it("reveals the per-project nav only after a project is selected", async () => {
    const user = userEvent.setup();
    renderSidebar();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /orbit-api/ }));
    expect(screen.getByRole("navigation", { name: /orbit-api navigation/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Project map/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Decisions/ })).toBeInTheDocument();
  });

  it("shows the open-decision count on the Decisions item (orbit-api has 3)", async () => {
    const user = userEvent.setup();
    renderSidebar();
    await user.click(screen.getByRole("button", { name: /orbit-api/ }));
    expect(screen.getByRole("button", { name: /Decisions/ })).toHaveTextContent("3");
  });

  it("marks the selected project with aria-current", async () => {
    const user = userEvent.setup();
    renderSidebar();
    await user.click(screen.getByRole("button", { name: /orbit-api/ }));
    expect(screen.getByRole("button", { name: /orbit-api/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("invokes onOpenMobile from the companion item", async () => {
    const user = userEvent.setup();
    const { onOpenMobile } = renderSidebar();
    await user.click(screen.getByRole("button", { name: /orbit-api/ }));
    await user.click(screen.getByRole("button", { name: /Mobile companion/ }));
    expect(onOpenMobile).toHaveBeenCalledOnce();
  });

  it("labels the icon-only add-project control", () => {
    renderSidebar();
    expect(screen.getByRole("button", { name: /Add project/ })).toBeInTheDocument();
  });
});
