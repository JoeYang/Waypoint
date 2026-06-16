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

// Slice 1: a fully enriched decision — rationale, per-option consequences, named blocked
// work, the goal it ladders toward, and provenance.
const enrichedDecision: InboxItem = {
  ...decision,
  rationale: "We retry the queue, so the store must survive restarts.",
  options: [
    { id: "opt-1", label: "Redis", consequence: "in-memory; lost on restart" },
    { id: "opt-2", label: "Postgres", consequence: "durable across restarts" },
  ],
  blocks: [
    { nodeId: "n-2", title: "refund worker" },
    { nodeId: "n-3", title: "audit log" },
  ],
  goalTitle: "Ship checkout",
  parkedBy: { agentLabel: "checkout-agent", at: 1000 },
};

const proposal: InboxItem = {
  ...decision,
  askId: "ask-3",
  type: "PROPOSAL",
  prompt: "Replace the poller with a webhook?",
  options: [],
  rationale: "The poller wastes 90% of its calls.",
};

const questionWithSuggestions: InboxItem = {
  ...question,
  suggestedAnswers: ["us-east-1", "eu-west-1"],
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

describe("InboxCard — decision context (task 6.1)", () => {
  it("renders rationale, per-option consequences, named blocked work, goal, and provenance", () => {
    render(<InboxCard item={enrichedDecision} working={false} onAnswer={vi.fn()} />);
    expect(screen.getByText(/retry the queue/i)).toBeInTheDocument();
    expect(screen.getByText(/durable across restarts/i)).toBeInTheDocument();
    expect(screen.getByText(/in-memory; lost on restart/i)).toBeInTheDocument();
    expect(screen.getByText("refund worker")).toBeInTheDocument();
    expect(screen.getByText("audit log")).toBeInTheDocument();
    expect(screen.getByText(/Ship checkout/)).toBeInTheDocument();
    expect(screen.getByText(/checkout-agent/)).toBeInTheDocument();
  });

  it("keeps the option button's accessible name to the label alone (consequence is a caption)", async () => {
    const onAnswer = vi.fn();
    render(<InboxCard item={enrichedDecision} working={false} onAnswer={onAnswer} />);
    await userEvent.click(screen.getByRole("button", { name: "Postgres" }));
    expect(onAnswer).toHaveBeenCalledWith({ expectedVersion: 3, chosenOptionId: "opt-2" });
  });

  it("degrades gracefully when context fields are absent", () => {
    render(<InboxCard item={decision} working={false} onAnswer={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Redis or in-memory?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Redis" })).toBeInTheDocument();
    // No provenance line invented when none was parked.
    expect(screen.queryByText(/parked by/i)).not.toBeInTheDocument();
  });
});

describe("InboxCard — proposal actions (task 6.2)", () => {
  it("renders Approve, Adjust, and Reject", () => {
    render(<InboxCard item={proposal} working={false} onAnswer={vi.fn()} />);
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /adjust/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
  });

  it("approves with the approve verdict", async () => {
    const onAnswer = vi.fn();
    render(<InboxCard item={proposal} working={false} onAnswer={onAnswer} />);
    await userEvent.click(screen.getByRole("button", { name: /approve/i }));
    expect(onAnswer).toHaveBeenCalledWith({ expectedVersion: 3, proposalVerdict: "approve" });
  });

  it("rejects with the reject verdict", async () => {
    const onAnswer = vi.fn();
    render(<InboxCard item={proposal} working={false} onAnswer={onAnswer} />);
    await userEvent.click(screen.getByRole("button", { name: /reject/i }));
    expect(onAnswer).toHaveBeenCalledWith({ expectedVersion: 3, proposalVerdict: "reject" });
  });

  it("opens a single constraint field only for Adjust and submits the note", async () => {
    const onAnswer = vi.fn();
    render(<InboxCard item={proposal} working={false} onAnswer={onAnswer} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /adjust/i }));
    await userEvent.type(screen.getByRole("textbox"), "  keep poller 30d  ");
    await userEvent.click(screen.getByRole("button", { name: /save constraint/i }));
    expect(onAnswer).toHaveBeenCalledWith({
      expectedVersion: 3,
      proposalVerdict: "adjust",
      adjustmentNote: "keep poller 30d",
    });
  });

  it("does not submit an adjust with an empty constraint", async () => {
    const onAnswer = vi.fn();
    render(<InboxCard item={proposal} working={false} onAnswer={onAnswer} />);
    await userEvent.click(screen.getByRole("button", { name: /adjust/i }));
    await userEvent.click(screen.getByRole("button", { name: /save constraint/i }));
    expect(onAnswer).not.toHaveBeenCalled();
  });
});

describe("InboxCard — question suggested answers (task 6.2)", () => {
  it("offers suggested answers as one-click buttons", async () => {
    const onAnswer = vi.fn();
    render(<InboxCard item={questionWithSuggestions} working={false} onAnswer={onAnswer} />);
    await userEvent.click(screen.getByRole("button", { name: "us-east-1" }));
    expect(onAnswer).toHaveBeenCalledWith({ expectedVersion: 1, answerText: "us-east-1" });
  });

  it("still allows free text as a fallback", async () => {
    const onAnswer = vi.fn();
    render(<InboxCard item={questionWithSuggestions} working={false} onAnswer={onAnswer} />);
    await userEvent.type(screen.getByRole("textbox", { name: /Which region/ }), "ap-south-1");
    await userEvent.click(screen.getByRole("button", { name: /^answer$/i }));
    expect(onAnswer).toHaveBeenCalledWith({ expectedVersion: 1, answerText: "ap-south-1" });
  });
});

describe("InboxCard — self-contained unit (task 6.3)", () => {
  it("renders and answers with no surrounding shell, store, or provider", async () => {
    const onAnswer = vi.fn();
    // Rendered in isolation with plain props — slice 2 can re-home it unchanged.
    render(<InboxCard item={decision} working={false} onAnswer={onAnswer} />);
    await userEvent.click(screen.getByRole("button", { name: "In-memory" }));
    expect(onAnswer).toHaveBeenCalledWith({ expectedVersion: 3, chosenOptionId: "opt-2" });
  });
});
