// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { WaypointProvider, useWaypoint } from "../wp/WaypointProvider.js";
import { ToastProvider } from "./ToastProvider.js";
import { DecisionCard } from "./DecisionCard.js";
import styles from "./DecisionCard.module.css";
import type { Decision } from "../wp/types.js";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

// Render the card against a decision pulled from the live mock data, so the provider's resolve /
// adjust (which look the decision up by id) operate on a real entry. `patch` overrides fields.
function CardFor({ id, patch }: { id: string; patch?: Partial<Decision> }): React.JSX.Element {
  const { data } = useWaypoint();
  const found = data.projects.flatMap((p) => p.decisions).find((d) => d.id === id);
  if (!found) return <span>missing</span>;
  return <DecisionCard decision={{ ...found, ...patch }} />;
}

const renderCard = (id: string, patch?: Partial<Decision>) =>
  render(
    <WaypointProvider>
      <CardFor id={id} patch={patch} />
    </WaypointProvider>,
  );

const chips = () => within(screen.getByRole("radiogroup", { name: /options/i }));

// Same as renderCard but wrapped in a ToastProvider, for the toast-confirmation cases.
const renderWith = (id: string, patch?: Partial<Decision>) =>
  render(
    <WaypointProvider>
      <ToastProvider>
        <CardFor id={id} patch={patch} />
      </ToastProvider>
    </WaypointProvider>,
  );

describe("DecisionCard", () => {
  it("shows the question, risk, and the agent's recommended approve action", () => {
    renderCard("d1");
    expect(
      screen.getByRole("heading", { name: /Which ORM should the data layer use/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Medium risk")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Approve Drizzle/ })).toBeInTheDocument();
    expect(screen.getByText(/Agent recommends Drizzle/)).toBeInTheDocument();
    // Collapsed: the review panel (option chips) is not shown yet.
    expect(screen.queryByRole("radiogroup", { name: /options/i })).not.toBeInTheDocument();
  });

  it("marks a decision parked since you left as NEW", () => {
    renderCard("d1", { isNew: true });
    expect(screen.getByText("NEW")).toBeInTheDocument();
  });

  it("gives a new-since-you-left card the new-accent ring class", () => {
    const { container } = renderCard("d1", { isNew: true });
    const card = container.querySelector<HTMLElement>(`.${styles.card}`);
    expect(card?.className).toContain(styles.new);
  });

  it("leaves a seen card without the new-accent ring class", () => {
    const { container } = renderCard("d1", { isNew: false });
    const card = container.querySelector<HTMLElement>(`.${styles.card}`);
    expect(card?.className).not.toContain(styles.new);
  });

  it("gives the recommended review chip an accent wash distinct from alternatives", async () => {
    const user = userEvent.setup();
    const { container } = renderCard("d1");
    await user.click(screen.getByRole("button", { name: /Review & redirect/i }));
    const allChips = container.querySelectorAll<HTMLElement>(`.${styles.chip}`);
    const recChip = Array.from(allChips).find((c) => /Recommended/.test(c.textContent ?? ""));
    const otherChip = Array.from(allChips).find((c) => !/Recommended/.test(c.textContent ?? ""));
    expect(recChip?.className).toContain(styles.recChip);
    expect(otherChip?.className).not.toContain(styles.recChip);
  });

  it("approves the recommendation inline and shows the resolved row", async () => {
    const user = userEvent.setup();
    renderCard("d1");
    await user.click(screen.getByRole("button", { name: /Approve Drizzle/ }));
    expect(screen.getByText(/agent is applying/i)).toBeInTheDocument();
    expect(screen.getByText("Drizzle")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve Drizzle/ })).not.toBeInTheDocument();
  });

  it("expands to review, lets you pick another option, and applies it", async () => {
    const user = userEvent.setup();
    renderCard("d1");
    await user.click(screen.getByRole("button", { name: /Review & redirect/i }));
    await user.click(chips().getByRole("radio", { name: /Prisma/ }));
    expect(chips().getByRole("radio", { name: /Prisma/ })).toBeChecked();
    await user.click(screen.getByRole("button", { name: /Apply Prisma/ }));
    expect(screen.getByText(/agent is applying/i)).toBeInTheDocument();
    expect(screen.getByText("Prisma")).toBeInTheDocument();
  });

  it("sends a redirect constraint as an adjustment when the textarea is filled", async () => {
    const user = userEvent.setup();
    renderCard("d1");
    await user.click(screen.getByRole("button", { name: /Review & redirect/i }));
    const note = "Use Drizzle but keep the Repository seam";
    await user.type(screen.getByRole("textbox", { name: /redirect the agent/i }), note);
    // With a constraint present the primary action becomes "Send & apply …".
    await user.click(screen.getByRole("button", { name: /Send & apply/i }));
    expect(screen.getByText(/agent is applying/i)).toBeInTheDocument();
    expect(screen.getByText(note)).toBeInTheDocument();
  });

  it("toasts a confirmation when applying the recommendation", async () => {
    const user = userEvent.setup();
    renderWith("d1");
    await user.click(screen.getByRole("button", { name: /Approve Drizzle/ }));
    expect(screen.getByRole("status", { name: /notifications/i })).toHaveTextContent(
      "Applied Drizzle — agent resuming",
    );
  });

  it("toasts an adjustment confirmation on the Send & apply constraint path", async () => {
    const user = userEvent.setup();
    renderWith("d1");
    await user.click(screen.getByRole("button", { name: /Review & redirect/i }));
    await user.type(
      screen.getByRole("textbox", { name: /redirect the agent/i }),
      "Keep the Repository seam",
    );
    await user.click(screen.getByRole("button", { name: /Send & apply/i }));
    expect(screen.getByRole("status", { name: /notifications/i })).toHaveTextContent(
      "Sent your adjustment — agent resuming",
    );
  });

  it("can cancel out of the review panel", async () => {
    const user = userEvent.setup();
    renderCard("d1");
    await user.click(screen.getByRole("button", { name: /Review & redirect/i }));
    expect(screen.getByRole("radiogroup", { name: /options/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(screen.queryByRole("radiogroup", { name: /options/i })).not.toBeInTheDocument();
  });
});
