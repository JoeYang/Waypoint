// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import type { InboxItem } from "@waypoint/shared";
import { InboxCard } from "../InboxCard.js";

afterEach(cleanup);

const decision: InboxItem = {
  askId: "ask-1",
  nodeId: "node-1",
  nodeTitle: "Pick a cache",
  type: "DECISION",
  state: "OPEN",
  prompt: "Redis or in-memory?",
  required: true,
  options: [
    { id: "opt-1", label: "Redis" },
    { id: "opt-2", label: "In-memory" },
  ],
  blastRadius: 2,
  parkedAt: 1000,
  askVersion: 3,
  nodeVersion: 4,
};

const question: InboxItem = {
  ...decision,
  askId: "ask-2",
  type: "QUESTION",
  prompt: "Which region should we deploy to?",
  options: [],
  blastRadius: 1,
  askVersion: 1,
};

describe("InboxCard", () => {
  it("shows the prompt, node context, and a blocks N badge", () => {
    render(<InboxCard item={decision} working={false} onAnswer={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Redis or in-memory?" })).toBeInTheDocument();
    expect(screen.getByText("Pick a cache")).toBeInTheDocument();
    expect(screen.getByText(/blocks 2/)).toBeInTheDocument();
  });

  it("answers a decision with the chosen option id and the ask's current version", async () => {
    const onAnswer = vi.fn();
    render(<InboxCard item={decision} working={false} onAnswer={onAnswer} />);
    await userEvent.click(screen.getByRole("button", { name: "Redis" }));
    expect(onAnswer).toHaveBeenCalledWith({ expectedVersion: 3, chosenOptionId: "opt-1" });
  });

  it("answers a question with the trimmed free text", async () => {
    const onAnswer = vi.fn();
    render(<InboxCard item={question} working={false} onAnswer={onAnswer} />);
    await userEvent.type(
      screen.getByRole("textbox", { name: "Which region should we deploy to?" }),
      "  us-east-1  ",
    );
    await userEvent.click(screen.getByRole("button", { name: /answer/i }));
    expect(onAnswer).toHaveBeenCalledWith({ expectedVersion: 1, answerText: "us-east-1" });
  });

  it("does not answer a question on empty input", async () => {
    const onAnswer = vi.fn();
    render(<InboxCard item={question} working={false} onAnswer={onAnswer} />);
    await userEvent.click(screen.getByRole("button", { name: /answer/i }));
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("announces a working state and hides the answer controls", () => {
    render(<InboxCard item={decision} working={true} onAnswer={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent(/working/i);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("article")).toHaveAttribute("aria-busy", "true");
  });
});
