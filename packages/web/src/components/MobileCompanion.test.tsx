// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { WaypointProvider } from "../wp/WaypointProvider.js";
import { WP_DATA } from "../wp/fixtures.js";
import { mockSource, type WaypointSource } from "../wp/source.js";
import { MobileCompanion } from "./MobileCompanion.js";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const renderCompanion = (onClose = (): void => {}, source?: WaypointSource) =>
  render(
    <WaypointProvider {...(source ? { source } : {})}>
      <MobileCompanion onClose={onClose} />
    </WaypointProvider>,
  );

describe("MobileCompanion", () => {
  it("lists parked decisions from across all projects", () => {
    renderCompanion();
    // orbit-api's d1 and atlas-web's a1 both surface in the one phone list.
    expect(
      screen.getByRole("article", { name: /Which ORM should the data layer use/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("article", { name: /Adopt Radix UI/ })).toBeInTheDocument();
  });

  it("approves a reversible decision locally, flipping the card", async () => {
    const user = userEvent.setup();
    renderCompanion();
    const card = within(
      screen.getByRole("article", { name: /Which ORM should the data layer use/ }),
    );
    await user.click(card.getByRole("button", { name: "Approve" }));
    expect(screen.getByText(/Approved · Drizzle/)).toBeInTheDocument();
  });

  it("offers review-on-desktop (not approve) for a one-way decision", () => {
    renderCompanion();
    // d3 (Merge users and accounts tables) is one-way.
    const card = within(
      screen.getByRole("article", { name: /Merge the users and accounts tables/ }),
    );
    expect(card.getByRole("button", { name: /Review on desktop/ })).toBeInTheDocument();
    expect(card.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("closes via the close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderCompanion(onClose);
    await user.click(screen.getByRole("button", { name: /Close companion/ }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows the all-clear empty state when nothing is parked", () => {
    const data = {
      ...WP_DATA,
      projects: WP_DATA.projects.map((p) => ({ ...p, decisions: [] })),
    };
    const emptySource: WaypointSource = {
      ...mockSource,
      initial: () => data,
      load: () => Promise.resolve(data),
      subscribe: () => () => {},
      answer: () => Promise.resolve(),
    };
    renderCompanion(() => {}, emptySource);
    expect(screen.getByText(/All clear/)).toBeInTheDocument();
    expect(screen.getByText(/0 waiting/)).toBeInTheDocument();
  });
});
