// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { WaypointProvider } from "../wp/WaypointProvider.js";
import { mockSource, type WaypointSource } from "../wp/source.js";
import { TimelineDrawer } from "./TimelineDrawer.js";

afterEach(cleanup);

// orbit-api is the mock project; d1 ("Which ORM…") is its first open decision. MOCK_DIGEST
// sinceSeq=0 ⇒ every story entry is new ⇒ the divider sits at the top of the replay.
const PROJECT = "orbit-api";

const renderWith = (source: WaypointSource, onClose: () => void = () => {}) =>
  render(
    <WaypointProvider source={source}>
      <TimelineDrawer projectId={PROJECT} onClose={onClose} />
    </WaypointProvider>,
  );

describe("TimelineDrawer", () => {
  it("pins the needs-you cards and replays the session story", async () => {
    renderWith(mockSource);

    const dialog = await screen.findByRole("dialog", { name: /while you were away/i });
    // Pinned needs-you header: count + an actionable DecisionCard for an open decision.
    expect(dialog).toHaveTextContent(/needs you/i);
    expect(await within(dialog).findByText(/which orm should the data layer use/i)).toBeVisible();
    expect(within(dialog).getAllByRole("button", { name: /approve/i }).length).toBeGreaterThan(0);
    // Session replay — a story entry renders its node title (and summary label).
    expect(dialog).toHaveTextContent(/Wire the spine to live data/i);
    expect(dialog).toHaveTextContent(/moved to DONE/i);
    // The resolved actor label is shown when present.
    expect(dialog).toHaveTextContent(/brave-lark/i);
  });

  it("renders the 'new since you left' divider (cursor 0 ⇒ all entries new)", async () => {
    renderWith(mockSource);
    const dialog = await screen.findByRole("dialog", { name: /while you were away/i });
    expect(await within(dialog).findByText(/new since you left/i)).toBeVisible();
  });

  it("omits the divider when no entry is newer than the cursor", async () => {
    // sinceSeq at the latest seq ⇒ no story entry is past it ⇒ no divider.
    const source: WaypointSource = {
      ...mockSource,
      digest: () => mockSource.digest(PROJECT).then((d) => ({ ...d, sinceSeq: 99 })),
    };
    renderWith(source);
    const dialog = await screen.findByRole("dialog", { name: /while you were away/i });
    // The story still renders…
    expect(await within(dialog).findByText(/Wire the spine to live data/i)).toBeVisible();
    // …but the boundary divider does not.
    expect(within(dialog).queryByText(/new since you left/i)).toBeNull();
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

  it("shows the loading state before data resolves", () => {
    const source: WaypointSource = { ...mockSource, digest: () => new Promise<never>(() => {}) };
    renderWith(source);
    expect(screen.getByRole("dialog", { name: /while you were away/i })).toHaveTextContent(
      /catching you up/i,
    );
  });

  it("shows an error state with a retry when the story fails", async () => {
    let attempts = 0;
    const source: WaypointSource = {
      ...mockSource,
      story: () => {
        attempts += 1;
        return attempts === 1 ? Promise.reject(new Error("offline")) : mockSource.story(PROJECT);
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
