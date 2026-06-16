// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { RiskBadge } from "./RiskBadge.js";
import { RevBadge } from "./RevBadge.js";

afterEach(cleanup);

describe("RiskBadge", () => {
  it("labels each risk level", () => {
    const { rerender } = render(<RiskBadge risk="low" />);
    expect(screen.getByText("Low risk")).toBeInTheDocument();
    rerender(<RiskBadge risk="medium" />);
    expect(screen.getByText("Medium risk")).toBeInTheDocument();
    rerender(<RiskBadge risk="high" />);
    expect(screen.getByText("High risk")).toBeInTheDocument();
  });
});

describe("RevBadge", () => {
  it("shows 'Reversible' when reversible", () => {
    render(<RevBadge reversible={true} />);
    expect(screen.getByText("Reversible")).toBeInTheDocument();
  });

  it("shows 'One-way' when not reversible", () => {
    render(<RevBadge reversible={false} />);
    expect(screen.getByText("One-way")).toBeInTheDocument();
  });
});
