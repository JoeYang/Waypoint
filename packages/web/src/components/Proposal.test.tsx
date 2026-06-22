// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { WaypointProvider, useWaypoint } from "../wp/WaypointProvider.js";
import { ToastProvider } from "./ToastProvider.js";
import { NAV_KEY } from "../wp/state.js";
import { Proposal } from "./Proposal.js";
import styles from "./Proposal.module.css";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const seedProposal = (project: string, decision: string): void =>
  localStorage.setItem(NAV_KEY, JSON.stringify({ project, view: "proposal", decision }));

function Probe(): React.JSX.Element {
  const { nav } = useWaypoint();
  return <span data-testid="loc">{`${nav.project}/${nav.view}`}</span>;
}

const renderProposal = () =>
  render(
    <WaypointProvider>
      <Proposal />
      <Probe />
    </WaypointProvider>,
  );

const options = () => within(screen.getByRole("radiogroup", { name: /options/i }));

describe("Proposal", () => {
  it("renders the question, badges, context, and the three options", () => {
    seedProposal("orbit-api", "d1");
    renderProposal();
    expect(
      screen.getByRole("heading", { name: /Which ORM should the data layer use/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Medium risk")).toBeInTheDocument();
    expect(screen.getByText(/Why this came up/i)).toBeInTheDocument();
    expect(screen.getByText(/About to write the first six repository modules/)).toBeInTheDocument();
    expect(options().getByRole("radio", { name: /Prisma/ })).toBeInTheDocument();
    expect(options().getByRole("radio", { name: /Drizzle/ })).toBeInTheDocument();
    expect(options().getByRole("radio", { name: /Knex/ })).toBeInTheDocument();
    // The recommended option carries the agent tag; the defer callout is present.
    expect(screen.getByText(/Agent recommends/)).toBeInTheDocument();
    expect(screen.getByText(/If you defer/)).toBeInTheDocument();
  });

  it("defaults selection to the recommended option", () => {
    seedProposal("orbit-api", "d1");
    renderProposal();
    expect(options().getByRole("radio", { name: /Drizzle/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "Approve recommendation" })).toBeInTheDocument();
  });

  it("switches the action when a non-recommended option is selected", async () => {
    const user = userEvent.setup();
    seedProposal("orbit-api", "d1");
    renderProposal();
    await user.click(options().getByRole("radio", { name: /Prisma/ }));
    expect(options().getByRole("radio", { name: /Prisma/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "Apply Prisma" })).toBeInTheDocument();
    expect(screen.getByText(/Overriding the recommendation/)).toBeInTheDocument();
  });

  it("resolves and shows the resolved banner, hiding the actions", async () => {
    const user = userEvent.setup();
    seedProposal("orbit-api", "d1");
    renderProposal();
    await user.click(screen.getByRole("button", { name: "Approve recommendation" }));
    expect(screen.getByText(/Resolved — agent is applying/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Approve recommendation" }),
    ).not.toBeInTheDocument();
  });

  it("toasts a confirmation when an option is applied", async () => {
    const user = userEvent.setup();
    seedProposal("orbit-api", "d1");
    render(
      <WaypointProvider>
        <ToastProvider>
          <Proposal />
        </ToastProvider>
      </WaypointProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Approve recommendation" }));
    expect(screen.getByRole("status", { name: /notifications/i })).toHaveTextContent(
      "Applied Drizzle — agent resuming",
    );
  });

  it("navigates back to the inbox via the back link", async () => {
    const user = userEvent.setup();
    seedProposal("orbit-api", "d1");
    renderProposal();
    await user.click(screen.getByRole("button", { name: /Back to decisions/ }));
    expect(screen.getByTestId("loc")).toHaveTextContent("orbit-api/inbox");
  });

  it("shows the typed-confirmation hint for a one-way decision", () => {
    seedProposal("orbit-api", "d3"); // d3 is one-way (not reversible)
    renderProposal();
    expect(screen.getByText(/Needs typed confirmation/)).toBeInTheDocument();
  });

  it("gives the recommended option an accent wash distinct from the alternatives", () => {
    seedProposal("orbit-api", "d1");
    const { container } = renderProposal();
    const opts = container.querySelectorAll<HTMLElement>(`.${styles.opt}`);
    const recOpt = Array.from(opts).find((o) => /Agent recommends/.test(o.textContent ?? ""));
    const otherOpt = Array.from(opts).find((o) => !/Agent recommends/.test(o.textContent ?? ""));
    expect(recOpt?.className).toContain(styles.rec);
    expect(otherOpt?.className).not.toContain(styles.rec);
  });

  it("gives a high-risk proposal a high-risk accent on the container", () => {
    seedProposal("orbit-api", "d3"); // d3 is high-risk
    const { container } = renderProposal();
    const prop = container.querySelector<HTMLElement>(`.${styles.prop}`);
    expect(prop?.className).toContain(styles.highRisk);
  });

  it("leaves a non-high-risk proposal without the high-risk accent", () => {
    seedProposal("orbit-api", "d1"); // d1 is medium-risk
    const { container } = renderProposal();
    const prop = container.querySelector<HTMLElement>(`.${styles.prop}`);
    expect(prop?.className).not.toContain(styles.highRisk);
  });
});
