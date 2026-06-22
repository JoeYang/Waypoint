// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { WaypointProvider } from "../wp/WaypointProvider.js";
import { mockSource, type WaypointSource } from "../wp/source.js";
import { Briefing } from "./Briefing.js";

afterEach(cleanup);

// orbit-api is the mock project; d1 is its first open decision.
const PROJECT = "orbit-api";

const renderWith = (source: WaypointSource, onClose: () => void = () => {}) =>
  render(
    <WaypointProvider source={source}>
      <Briefing projectId={PROJECT} onClose={onClose} />
    </WaypointProvider>,
  );

describe("Briefing", () => {
  it("leads with the decisions that need you and summarizes the rest", async () => {
    renderWith(mockSource);

    const dialog = await screen.findByRole("dialog", { name: /while you were away/i });
    // A needs-you DecisionCard renders for an open decision (its approve action is present).
    expect(await within(dialog).findByText(/which orm should the data layer use/i)).toBeVisible();
    expect(within(dialog).getAllByRole("button", { name: /approve/i }).length).toBeGreaterThan(0);
    // Active work line: "Data layer — Seed scripts".
    expect(dialog).toHaveTextContent(/Data layer — Seed scripts/i);
    // What moved.
    expect(dialog).toHaveTextContent(/Wire the spine to live data/i);
    // Heads up prompt.
    expect(dialog).toHaveTextContent(/Redis or in-process\?/i);
  });

  it("acks the digest cursor then closes when you jump into the session", async () => {
    const user = userEvent.setup();
    let ackedSeq = -1;
    const onClose = vi.fn();
    const source: WaypointSource = {
      ...mockSource,
      ackDigest: (_projectId, seq) => {
        ackedSeq = seq;
        return Promise.resolve();
      },
    };
    renderWith(source, onClose);
    await screen.findByRole("dialog", { name: /while you were away/i });

    await user.click(screen.getByRole("button", { name: /jump into the session/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(ackedSeq).toBe(3); // MOCK_DIGEST.seq
  });

  it("shows skeletons in the loading state while preserving the accessible loading signal", () => {
    // A digest that never resolves keeps the surface in loading.
    const source: WaypointSource = { ...mockSource, digest: () => new Promise<never>(() => {}) };
    const { container } = renderWith(source);
    // The accessible loading signal is preserved: a status region with an accessible "Loading…"
    // name (visually hidden), even though the visible content is now a skeleton.
    const status = screen.getByRole("status");
    expect(status).toHaveAccessibleName(/Loading/i);
    // The visible decoration is a skeleton placeholder (aria-hidden).
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it("shows an error state with a retry when the digest fails", async () => {
    let attempts = 0;
    const source: WaypointSource = {
      ...mockSource,
      digest: () => {
        attempts += 1;
        return attempts === 1 ? Promise.reject(new Error("offline")) : mockSource.digest(PROJECT);
      },
    };
    const user = userEvent.setup();
    renderWith(source);

    const dialog = await screen.findByRole("dialog", { name: /while you were away/i });
    expect(dialog).toHaveTextContent(/couldn.t load/i);
    await user.click(within(dialog).getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(attempts).toBe(2));
  });
});
