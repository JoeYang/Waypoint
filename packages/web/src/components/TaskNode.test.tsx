// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { TaskNode } from "./TaskNode.js";
import styles from "./TaskNode.module.css";
import type { Task } from "../wp/types.js";

afterEach(cleanup);

const task = (over: Partial<Task>): Task => ({ name: "Task", status: "queued", ...over });
const noop = (): void => {};

describe("TaskNode", () => {
  it("renders a done task by name", () => {
    render(
      <TaskNode
        task={task({ name: "Auth middleware", status: "done" })}
        resolved={false}
        onOpenDecision={noop}
      />,
    );
    expect(screen.getByText("Auth middleware")).toBeInTheDocument();
  });

  it("shows the note on an active task", () => {
    render(
      <TaskNode
        task={task({ name: "Seed scripts", status: "active", note: "agent editing now" })}
        resolved={false}
        onOpenDecision={noop}
      />,
    );
    expect(screen.getByText("agent editing now")).toBeInTheDocument();
  });

  it("marks the 'you are here' task and hides its note", () => {
    render(
      <TaskNode
        task={task({ name: "Seed scripts", status: "active", note: "hidden", here: true })}
        resolved={false}
        onOpenDecision={noop}
      />,
    );
    expect(screen.getByText(/You are here/)).toBeInTheDocument();
    expect(screen.queryByText("hidden")).not.toBeInTheDocument();
  });

  it("renders a blocked task as a button that opens its decision", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <TaskNode
        task={task({ name: "Choose ORM", status: "blocked", decision: "d1" })}
        resolved={false}
        onOpenDecision={onOpen}
      />,
    );
    expect(screen.getByText(/Decision parked/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Choose ORM/ }));
    expect(onOpen).toHaveBeenCalledWith("d1");
  });

  it("a resolved blocked task shows 'resolved → resuming' and is no longer clickable", () => {
    render(
      <TaskNode
        task={task({ name: "Choose ORM", status: "blocked", decision: "d1" })}
        resolved={true}
        onOpenDecision={noop}
      />,
    );
    expect(screen.getByText(/resolved → resuming/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/Decision parked/)).not.toBeInTheDocument();
  });

  it("draws a future (dashed) connector for a queued task", () => {
    const { container } = render(
      <TaskNode
        task={task({ name: "Validation", status: "queued" })}
        resolved={false}
        onOpenDecision={noop}
      />,
    );
    const conn = container.querySelector(`.${styles.conn}`);
    expect(conn).not.toBeNull();
    expect(conn?.className).toContain(styles.future);
  });

  it("draws a solid connector for a done task", () => {
    const { container } = render(
      <TaskNode
        task={task({ name: "Auth middleware", status: "done" })}
        resolved={false}
        onOpenDecision={noop}
      />,
    );
    const conn = container.querySelector(`.${styles.conn}`);
    expect(conn).not.toBeNull();
    expect(conn?.className).not.toContain(styles.future);
  });
});
