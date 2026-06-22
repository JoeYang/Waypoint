// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { WaypointProvider } from "../wp/WaypointProvider.js";
import { mockSource, type WaypointSource } from "../wp/source.js";
import { MissionControl } from "./MissionControl.js";

afterEach(cleanup);

// orbit-api is the mock project; d1 ("Which ORM…") is its first open decision.
const PROJECT = "orbit-api";

const renderWith = (source: WaypointSource, onClose: () => void = () => {}) =>
  render(
    <WaypointProvider source={source}>
      <MissionControl projectId={PROJECT} onClose={onClose} />
    </WaypointProvider>,
  );

describe("MissionControl", () => {
  it("presents the three-column command deck over the ready model", async () => {
    renderWith(mockSource);

    const dialog = await screen.findByRole("dialog", { name: /while you were away/i });
    // Top-bar greeting.
    expect(dialog).toHaveTextContent(/welcome back, joe yang/i);
    // Needs you — an actionable DecisionCard renders for an open decision.
    expect(await within(dialog).findByText(/which orm should the data layer use/i)).toBeVisible();
    expect(within(dialog).getAllByRole("button", { name: /approve/i }).length).toBeGreaterThan(0);
    // Heads up sub-section.
    expect(dialog).toHaveTextContent(/redis or in-process\?/i);
    // Where things stand now — active work line "Data layer — Seed scripts".
    expect(dialog).toHaveTextContent(/Data layer — Seed scripts/i);
    // Streams mini-list — a per-stream progress row (Data layer: 1 of 3 tasks done).
    const dataLayer = within(dialog).getByRole("progressbar", { name: /data layer/i });
    expect(dataLayer).toHaveAttribute("aria-valuenow", "33");
    // While you were away — the moved feed.
    expect(dialog).toHaveTextContent(/Wire the spine to live data/i);
  });

  it("acks the digest cursor then closes when you enter the session", async () => {
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

    await user.click(screen.getByRole("button", { name: /enter session/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(ackedSeq).toBe(3); // MOCK_DIGEST.seq
  });

  it("skips to the session without acking the cursor", async () => {
    const user = userEvent.setup();
    let acked = false;
    const onClose = vi.fn();
    const source: WaypointSource = {
      ...mockSource,
      ackDigest: () => {
        acked = true;
        return Promise.resolve();
      },
    };
    renderWith(source, onClose);
    await screen.findByRole("dialog", { name: /while you were away/i });

    await user.click(screen.getByRole("button", { name: /skip to session/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(acked).toBe(false);
  });

  it("shows the loading state before data resolves", () => {
    const source: WaypointSource = { ...mockSource, digest: () => new Promise<never>(() => {}) };
    renderWith(source);
    expect(screen.getByRole("dialog", { name: /while you were away/i })).toHaveTextContent(
      /catching you up/i,
    );
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
