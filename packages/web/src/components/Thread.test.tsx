// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { WaypointProvider } from "../wp/WaypointProvider.js";
import { WP_DATA } from "../wp/fixtures.js";
import { NAV_KEY } from "../wp/state.js";
import { Thread } from "./Thread.js";
import { Proposal } from "./Proposal.js";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const d1 = WP_DATA.projects
  .find((p) => p.id === "orbit-api")!
  .decisions.find((d) => d.id === "d1")!;

const renderThread = () =>
  render(
    <WaypointProvider>
      <Thread decision={d1} />
    </WaypointProvider>,
  );

const seedProposal = (project: string, decision: string): void =>
  localStorage.setItem(NAV_KEY, JSON.stringify({ project, view: "proposal", decision }));

describe("Thread", () => {
  it("renders the existing conversation", () => {
    renderThread();
    expect(
      screen.getByText(/I need an ORM before writing the repository modules/),
    ).toBeInTheDocument();
    expect(screen.getByText(/What about migrations\?/)).toBeInTheDocument();
  });

  it("disables Send until the composer has non-whitespace text", async () => {
    const user = userEvent.setup();
    renderThread();
    const send = screen.getByRole("button", { name: /Send/ });
    expect(send).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: /Comment/i }), "Use Drizzle then");
    expect(send).toBeEnabled();
  });

  it("appends a you-message and an agent reply when a comment is sent", async () => {
    const user = userEvent.setup();
    renderThread();
    await user.type(
      screen.getByRole("textbox", { name: /Comment/i }),
      "Make migrations reviewable",
    );
    await user.click(screen.getByRole("button", { name: /Send/ }));
    expect(screen.getByText("Make migrations reviewable")).toBeInTheDocument();
    expect(screen.getByText(/Noted — I'll factor that in/)).toBeInTheDocument();
  });

  it("sends on ⌘↩ and clears the composer", async () => {
    const user = userEvent.setup();
    renderThread();
    const box = screen.getByRole("textbox", { name: /Comment/i });
    await user.type(box, "Ship it");
    await user.keyboard("{Meta>}{Enter}{/Meta}");
    expect(screen.getByText("Ship it")).toBeInTheDocument();
    expect(box).toHaveValue("");
  });
});

describe("Proposal + Thread integration", () => {
  it("appends the agent's resume message to the thread when resolved", async () => {
    const user = userEvent.setup();
    seedProposal("orbit-api", "d1");
    render(
      <WaypointProvider>
        <Proposal />
      </WaypointProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Approve recommendation" }));
    const convo = within(screen.getByRole("log", { name: /discussion/i }));
    expect(convo.getByText(/Applied Drizzle\. Resuming/)).toBeInTheDocument();
  });
});
