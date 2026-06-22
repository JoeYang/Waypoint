// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { WaypointProvider, useWaypoint } from "../wp/WaypointProvider.js";
import { NAV_KEY } from "../wp/state.js";
import { Inbox } from "./Inbox.js";
import styles from "./Inbox.module.css";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const seedInbox = (project: string): void =>
  localStorage.setItem(NAV_KEY, JSON.stringify({ project, view: "inbox", decision: null }));

// Surfaces nav + a resolve trigger so tests can drive provider actions.
function Probe(): React.JSX.Element {
  const { nav, resolve } = useWaypoint();
  return (
    <>
      <span data-testid="view">{nav.view}</span>
      <button type="button" onClick={() => resolve("d2", "Redis")}>
        resolve-d2
      </button>
      <button type="button" onClick={() => resolve("d1", "Drizzle")}>
        resolve-d1
      </button>
      <button type="button" onClick={() => resolve("d3", "Keep separate")}>
        resolve-d3
      </button>
    </>
  );
}

const renderInbox = () =>
  render(
    <WaypointProvider>
      <Inbox />
      <Probe />
    </WaypointProvider>,
  );

describe("Inbox", () => {
  it("lists the waiting decisions with the agent recommendation line", () => {
    seedInbox("orbit-api");
    renderInbox();
    // orbit-api has three open decisions; the heading reflects the count.
    expect(screen.getByRole("heading", { name: "3 waiting" })).toBeInTheDocument();
    // Each row echoes the agent's recommended option.
    expect(screen.getAllByText(/Agent recommends/).length).toBe(3);
  });

  it("opens the proposal when a queue row is clicked", async () => {
    const user = userEvent.setup();
    seedInbox("orbit-api");
    renderInbox();
    await user.click(screen.getByRole("button", { name: /Which ORM should the data layer use/i }));
    expect(screen.getByTestId("view")).toHaveTextContent("proposal");
  });

  it("filters to blocking-only and back", async () => {
    const user = userEvent.setup();
    seedInbox("orbit-api");
    renderInbox();
    const list = () => within(screen.getByRole("list", { name: /parked decisions/i }));
    const before = list().getAllByRole("listitem").length;
    await user.click(screen.getByRole("button", { name: "Blocking" }));
    const blockingCount = list().getAllByRole("listitem").length;
    expect(blockingCount).toBeLessThanOrEqual(before);
    // Non-blocking filter shows a different subset (fixes the prototype's "non" bug).
    await user.click(screen.getByRole("button", { name: "Non-blocking" }));
    expect(screen.getByRole("list", { name: /parked decisions/i })).toBeInTheDocument();
  });

  it("shows the no-match empty state when a filter excludes everything", async () => {
    const user = userEvent.setup();
    seedInbox("orbit-api");
    renderInbox();
    // Resolve every blocking decision, then filter to blocking → none match.
    await user.click(screen.getByRole("button", { name: "resolve-d1" }));
    await user.click(screen.getByRole("button", { name: "resolve-d2" }));
    // d3 is the remaining (non-blocking) decision; filtering to blocking empties the list.
    await user.click(screen.getByRole("button", { name: "Blocking" }));
    expect(screen.getByText(/No decisions in this filter/i)).toBeInTheDocument();
  });

  it("gives a high-risk row the high-risk edge class and leaves others unmarked", () => {
    seedInbox("orbit-api");
    const { container } = renderInbox();
    // orbit-api: d3 ("Merge the users and accounts tables?") is the high-risk decision.
    const rows = container.querySelectorAll<HTMLElement>(`.${styles.qrow}`);
    const highRow = Array.from(rows).find((r) =>
      /Merge the users and accounts/i.test(r.textContent ?? ""),
    );
    const mediumRow = Array.from(rows).find((r) =>
      /Which ORM should the data layer use/i.test(r.textContent ?? ""),
    );
    expect(highRow?.className).toContain(styles.high);
    expect(mediumRow?.className).not.toContain(styles.high);
  });

  it("renders a hover chevron affordance on each queue row", () => {
    seedInbox("orbit-api");
    const { container } = renderInbox();
    const chevrons = container.querySelectorAll(`.${styles.qchev}`);
    // One chevron per waiting decision (orbit-api has three).
    expect(chevrons.length).toBe(3);
  });

  it("shows the all-caught-up empty state when nothing is waiting", async () => {
    const user = userEvent.setup();
    seedInbox("orbit-api");
    renderInbox();
    await user.click(screen.getByRole("button", { name: "resolve-d1" }));
    await user.click(screen.getByRole("button", { name: "resolve-d2" }));
    await user.click(screen.getByRole("button", { name: "resolve-d3" }));
    expect(screen.getByRole("heading", { name: "All caught up" })).toBeInTheDocument();
    expect(screen.getByText(/Nothing waiting on you/i)).toBeInTheDocument();
  });
});
