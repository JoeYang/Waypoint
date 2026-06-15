// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import type { ProjectProgress, InboxItem } from "@waypoint/shared";
import { Spine } from "../Spine.js";

afterEach(cleanup);

const ask: InboxItem = {
  askId: "ask-1",
  nodeId: "t-cache",
  nodeTitle: "cache",
  type: "DECISION",
  state: "OPEN",
  prompt: "Redis or Postgres?",
  required: true,
  options: [
    { id: "opt-1", label: "Redis" },
    { id: "opt-2", label: "Postgres" },
  ],
  blastRadius: 3,
  parkedAt: 1000,
  askVersion: 1,
  nodeVersion: 1,
};

const progress: ProjectProgress = {
  projectId: "default",
  seq: 9,
  goals: [
    {
      nodeId: "g1",
      title: "Ship checkout",
      state: "at-risk",
      plansDone: 1,
      plansTotal: 2,
      openAskCount: 1,
      blastRadius: 0,
      plans: [
        {
          nodeId: "p1",
          title: "Refunds",
          state: "blocked",
          agentLabel: "checkout-agent",
          lastActivityAt: 1000,
          openAskCount: 1,
          blastRadius: 0,
          tasks: [
            {
              nodeId: "t-cache",
              title: "cache",
              state: "blocked-on-ask",
              agentLabel: "checkout-agent",
              blastRadius: 3,
              group: null,
              asks: [ask],
            },
            {
              nodeId: "t-done",
              title: "schema migration",
              state: "done",
              agentLabel: null,
              blastRadius: 0,
              group: null,
              asks: [],
            },
          ],
        },
        {
          nodeId: "p2",
          title: "Checkout UI",
          state: "done",
          agentLabel: null,
          lastActivityAt: 900,
          openAskCount: 0,
          blastRadius: 0,
          tasks: [
            {
              nodeId: "t-ui",
              title: "button",
              state: "done",
              agentLabel: null,
              blastRadius: 0,
              group: null,
              asks: [],
            },
          ],
        },
      ],
    },
  ],
};

describe("Spine — the project home (task 5.1)", () => {
  it("renders the goal header with state and plan progress", () => {
    render(<Spine progress={progress} workingAskIds={new Set()} onAnswer={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /Ship checkout/ })).toBeInTheDocument();
    expect(screen.getByText(/1\s*\/\s*2 plans/i)).toBeInTheDocument();
    expect(screen.getByText(/at-risk/i)).toBeInTheDocument();
  });

  it("renders plan sections with their state and owning agent", () => {
    render(<Spine progress={progress} workingAskIds={new Set()} onAnswer={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /Refunds/ })).toBeInTheDocument();
    expect(screen.getByText(/checkout-agent/)).toBeInTheDocument();
  });

  it("renders an ask in place on its task using the slice-1 decision card", async () => {
    const onAnswer = vi.fn();
    render(<Spine progress={progress} workingAskIds={new Set()} onAnswer={onAnswer} />);
    // The card's prompt and intent-matched option buttons are present, on the task.
    expect(screen.getByRole("heading", { name: "Redis or Postgres?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Postgres" }));
    expect(onAnswer).toHaveBeenCalledWith("ask-1", { expectedVersion: 1, chosenOptionId: "opt-2" });
  });
});

describe("Spine — weight and the live edge (task 5.2 / 5.3)", () => {
  it("shows importance as visual weight without reordering the tasks", () => {
    render(<Spine progress={progress} workingAskIds={new Set()} onAnswer={vi.fn()} />);
    // The high-blast task is marked heavier, but task order follows the data (not blast sort).
    const cache = screen.getByTestId("task-t-cache");
    expect(cache).toHaveAttribute("data-weight", "3");
  });

  it("collapses completed work to the live edge by default and expands on request", async () => {
    render(<Spine progress={progress} workingAskIds={new Set()} onAnswer={vi.fn()} />);
    const refunds = within(screen.getByTestId("plan-p1"));
    // The blocked task (live edge) is always visible; the done task is hidden until expanded.
    expect(refunds.getByTestId("task-t-cache")).toBeInTheDocument();
    expect(refunds.queryByTestId("task-t-done")).not.toBeInTheDocument();

    await userEvent.click(refunds.getByRole("button", { name: /1 done/i }));
    expect(refunds.getByTestId("task-t-done")).toBeInTheDocument();
  });

  it("marks a fully-done plan as settled/dimmed", () => {
    render(<Spine progress={progress} workingAskIds={new Set()} onAnswer={vi.fn()} />);
    const uiPlan = screen.getByTestId("plan-p2");
    expect(uiPlan).toHaveAttribute("data-state", "done");
  });
});

describe("Spine — empty state", () => {
  it("shows an explicit empty state when the project has no goals", () => {
    render(
      <Spine
        progress={{ projectId: "default", seq: 0, goals: [] }}
        workingAskIds={new Set()}
        onAnswer={vi.fn()}
      />,
    );
    expect(screen.getByText(/no goals yet/i)).toBeInTheDocument();
  });
});
