// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Skeleton } from "./Skeleton.js";

afterEach(cleanup);

describe("Skeleton", () => {
  it("renders a single decorative block hidden from the accessibility tree", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toBeInTheDocument();
    // Decorative: contributes nothing to the a11y tree.
    expect(el).toHaveAttribute("aria-hidden", "true");
    // A bare block has no line children.
    expect(el.querySelectorAll("[data-skeleton-line]").length).toBe(0);
  });

  it("renders N line placeholders when lines is given, still aria-hidden", () => {
    const { container } = render(<Skeleton lines={3} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el.querySelectorAll("[data-skeleton-line]").length).toBe(3);
  });

  it("applies dynamic width/height/radius as inline style on a block", () => {
    const { container } = render(<Skeleton width={120} height="2rem" radius="9999px" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.width).toBe("120px");
    expect(el.style.height).toBe("2rem");
    expect(el.style.borderRadius).toBe("9999px");
  });

  it("applies caller width to each line in a lines skeleton", () => {
    const { container } = render(<Skeleton lines={2} width="80%" height={10} />);
    const lines = container.querySelectorAll<HTMLElement>("[data-skeleton-line]");
    expect(lines.length).toBe(2);
    for (const line of lines) {
      expect(line.style.width).toBe("80%");
      expect(line.style.height).toBe("10px");
    }
  });
});
