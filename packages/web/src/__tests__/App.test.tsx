// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { App } from "../App.js";

afterEach(cleanup);

describe("App shell", () => {
  it("renders the Axiom-styled inbox chrome", () => {
    render(<App />);
    expect(screen.getByText("Waypoint")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /decision inbox/i })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
