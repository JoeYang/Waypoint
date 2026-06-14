// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import type { InboxItem } from "@waypoint/shared";
import { InboxList } from "../InboxList.js";

afterEach(cleanup);

const item = (askId: string, prompt: string): InboxItem => ({
  askId,
  nodeId: `node-${askId}`,
  nodeTitle: `Node ${askId}`,
  type: "DECISION",
  state: "OPEN",
  prompt,
  required: true,
  options: [{ id: "opt-1", label: "Yes" }],
  blastRadius: 0,
  parkedAt: 1000,
  askVersion: 1,
  nodeVersion: 1,
});

describe("InboxList", () => {
  it("renders the cards in the order given (already ranked by the caller)", () => {
    render(
      <InboxList
        items={[item("a", "First ask"), item("b", "Second ask")]}
        workingAskIds={new Set()}
        onAnswer={vi.fn()}
      />,
    );
    const headings = screen.getAllByRole("heading").map((h) => h.textContent);
    expect(headings).toEqual(["First ask", "Second ask"]);
  });

  it("shows an empty state and no cards when there is nothing to answer", () => {
    render(<InboxList items={[]} workingAskIds={new Set()} onAnswer={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent(/nothing waiting/i);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("bubbles an answer with the originating askId", async () => {
    const onAnswer = vi.fn();
    render(
      <InboxList items={[item("a", "First ask")]} workingAskIds={new Set()} onAnswer={onAnswer} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(onAnswer).toHaveBeenCalledWith("a", { expectedVersion: 1, chosenOptionId: "opt-1" });
  });

  it("marks a card working when its askId is in the working set", () => {
    render(
      <InboxList
        items={[item("a", "First ask")]}
        workingAskIds={new Set(["a"])}
        onAnswer={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/working/i);
  });
});
