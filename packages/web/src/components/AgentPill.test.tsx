// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { AgentPill } from "./AgentPill.js";

afterEach(cleanup);

describe("AgentPill", () => {
  it("renders the compact working and idle labels", () => {
    const { rerender } = render(<AgentPill agent="working" tasks={6} />);
    expect(screen.getByText("Working")).toBeInTheDocument();
    rerender(<AgentPill agent="idle" />);
    expect(screen.getByText("Idle")).toBeInTheDocument();
  });

  it("prefixes and shows the task count when working", () => {
    const { container } = render(<AgentPill agent="working" tasks={6} prefixed />);
    expect(container.textContent).toContain("Agent working");
    expect(container.textContent).toContain("· 6 tasks");
  });

  it("prefixes the idle label", () => {
    render(<AgentPill agent="idle" prefixed />);
    expect(screen.getByText("Agent idle")).toBeInTheDocument();
  });
});
