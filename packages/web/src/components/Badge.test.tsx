// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Badge } from "./Badge.js";

afterEach(cleanup);

describe("Badge", () => {
  it("renders its content", () => {
    render(<Badge variant="warning">3 waiting</Badge>);
    expect(screen.getByText("3 waiting")).toBeInTheDocument();
  });

  it("renders an icon child alongside text", () => {
    render(
      <Badge variant="success">
        <svg data-testid="ico" />
        All caught up
      </Badge>,
    );
    expect(screen.getByTestId("ico")).toBeInTheDocument();
    expect(screen.getByText(/All caught up/)).toBeInTheDocument();
  });
});
