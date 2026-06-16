// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { WaypointProvider } from "../wp/WaypointProvider.js";
import { NAV_KEY } from "../wp/state.js";
import { Settings } from "./Settings.js";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const seed = (project: string): void =>
  localStorage.setItem(NAV_KEY, JSON.stringify({ project, view: "settings", decision: null }));

const renderSettings = () =>
  render(
    <WaypointProvider>
      <Settings />
    </WaypointProvider>,
  );

describe("Settings", () => {
  it("renders the heading and the three policy cards", () => {
    seed("orbit-api");
    renderSettings();
    expect(
      screen.getByRole("heading", { name: /How this agent works with you/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Decision policy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Streams" })).toBeInTheDocument();
  });

  it("reflects each toggle's default state via aria-pressed", () => {
    seed("orbit-api");
    renderSettings();
    // Auto-approve defaults on; Email digest defaults off.
    expect(screen.getByRole("button", { name: /Auto-approve low-risk/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Email digest/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("flips a toggle when clicked", async () => {
    const user = userEvent.setup();
    seed("orbit-api");
    renderSettings();
    const email = screen.getByRole("button", { name: /Email digest/ });
    expect(email).toHaveAttribute("aria-pressed", "false");
    await user.click(email);
    expect(email).toHaveAttribute("aria-pressed", "true");
  });

  it("renders an empty state when no project is selected", () => {
    renderSettings();
    expect(screen.getByText(/No project selected/i)).toBeInTheDocument();
  });
});
