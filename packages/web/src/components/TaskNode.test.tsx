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
  it("renders a done task by name with a done rail node", () => {
    const { container } = render(
      <TaskNode
        task={task({ name: "Auth middleware", status: "done" })}
        resolved={false}
        onOpenDecision={noop}
      />,
    );
    expect(screen.getByText("Auth middleware")).toBeInTheDocument();
    const marker = container.querySelector(`.${styles.marker}`);
    expect(marker).not.toBeNull();
    expect(marker?.className).toContain(styles.done);
  });

  it("shows the note on an active task and a glowing active node", () => {
    const { container } = render(
      <TaskNode
        task={task({ name: "Seed scripts", status: "active", note: "agent editing now" })}
        resolved={false}
        onOpenDecision={noop}
      />,
    );
    expect(screen.getByText("agent editing now")).toBeInTheDocument();
    const marker = container.querySelector(`.${styles.marker}`);
    expect(marker?.className).toContain(styles.active);
  });

  it("marks the 'you are here' task, anchors a pulsing node, and hides its note", () => {
    const { container } = render(
      <TaskNode
        task={task({ name: "Seed scripts", status: "active", note: "hidden", here: true })}
        resolved={false}
        onOpenDecision={noop}
      />,
    );
    expect(screen.getByText(/You are here/)).toBeInTheDocument();
    expect(screen.queryByText("hidden")).not.toBeInTheDocument();
    const marker = container.querySelector(`.${styles.marker}`);
    expect(marker?.className).toContain(styles.active);
    expect(marker?.className).toContain(styles.pulse);
  });

  it("renders a blocked task as a button (named by the task) that opens its decision", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const { container } = render(
      <TaskNode
        task={task({ name: "Choose ORM", status: "blocked", decision: "d1" })}
        resolved={false}
        onOpenDecision={onOpen}
      />,
    );
    expect(screen.getByText(/Decision parked/)).toBeInTheDocument();
    const marker = container.querySelector(`.${styles.marker}`);
    expect(marker?.className).toContain(styles.blocked);
    await user.click(screen.getByRole("button", { name: /Choose ORM/ }));
    expect(onOpen).toHaveBeenCalledWith("d1");
  });

  it("a resolved blocked task shows 'resolved → resuming', flips to an active node, no button", () => {
    const { container } = render(
      <TaskNode
        task={task({ name: "Choose ORM", status: "blocked", decision: "d1" })}
        resolved={true}
        onOpenDecision={noop}
      />,
    );
    expect(screen.getByText(/resolved → resuming/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/Decision parked/)).not.toBeInTheDocument();
    const marker = container.querySelector(`.${styles.marker}`);
    expect(marker?.className).toContain(styles.active);
  });

  it("draws a future (dashed) connector for a queued task with a faint queued node", () => {
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
    const marker = container.querySelector(`.${styles.marker}`);
    expect(marker?.className).toContain(styles.queued);
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

  it("markers are decorative — the task name carries the accessible meaning", () => {
    const { container } = render(
      <TaskNode
        task={task({ name: "Auth middleware", status: "done" })}
        resolved={false}
        onOpenDecision={noop}
      />,
    );
    const rail = container.querySelector(`.${styles.rail}`);
    expect(rail).not.toBeNull();
    expect(rail?.getAttribute("aria-hidden")).toBe("true");
  });
});
