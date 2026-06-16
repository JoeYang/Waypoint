// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { WaypointProvider } from "../wp/WaypointProvider.js";
import { NAV_KEY } from "../wp/state.js";
import { Activity } from "./Activity.js";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const seed = (project: string): void =>
  localStorage.setItem(NAV_KEY, JSON.stringify({ project, view: "activity", decision: null }));

const renderActivity = () =>
  render(
    <WaypointProvider>
      <Activity />
    </WaypointProvider>,
  );

describe("Activity", () => {
  it("renders the heading and the time-grouped timeline", () => {
    seed("orbit-api");
    renderActivity();
    expect(screen.getByRole("heading", { name: /What happened this morning/ })).toBeInTheDocument();
    expect(screen.getByText("11:18 — now")).toBeInTheDocument();
    expect(screen.getByText("11:04")).toBeInTheDocument();
  });

  it("renders item text, stream tag, and sub-line", () => {
    seed("orbit-api");
    renderActivity();
    expect(screen.getByText("Editing src/db/seed.ts")).toBeInTheDocument();
    expect(screen.getAllByText("Data layer").length).toBeGreaterThan(0);
    expect(screen.getByText("continued on 5 unblocked tasks")).toBeInTheDocument();
  });

  it("renders an empty state when no project is selected", () => {
    renderActivity();
    expect(screen.getByText(/No project selected/i)).toBeInTheDocument();
  });
});
