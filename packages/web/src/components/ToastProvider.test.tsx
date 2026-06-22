// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { ToastProvider, useToast } from "./ToastProvider.js";

afterEach(cleanup);

// A button that enqueues a toast on click — exercises the hook through real interaction rather
// than reaching into internals.
function Emit({ message }: { message: string }): React.JSX.Element {
  const { toast } = useToast();
  return (
    <button type="button" onClick={() => toast(message)}>
      emit
    </button>
  );
}

const region = () => screen.getByRole("status", { name: /notifications/i });

describe("ToastProvider", () => {
  it("renders an enqueued message in a polite live region", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Emit message="Applied Drizzle — agent resuming" />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "emit" }));
    expect(region()).toHaveTextContent("Applied Drizzle — agent resuming");
    expect(region()).toHaveAttribute("aria-live", "polite");
  });

  it("auto-dismisses a toast after its timeout elapses", () => {
    vi.useFakeTimers();
    try {
      render(
        <ToastProvider>
          <Emit message="goes away" />
        </ToastProvider>,
      );
      // fireEvent (not userEvent) so the click is synchronous under fake timers.
      fireEvent.click(screen.getByRole("button", { name: "emit" }));
      expect(screen.getByText("goes away")).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(screen.queryByText("goes away")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("removes a toast when its dismiss button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Emit message="dismiss me" />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "emit" }));
    expect(screen.getByText("dismiss me")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText("dismiss me")).not.toBeInTheDocument();
  });

  it("exposes a no-op toast when used outside a provider (no throw)", async () => {
    const user = userEvent.setup();
    // No ToastProvider wrapper — the hook must degrade to a no-op so call sites stay safe.
    render(<Emit message="ignored" />);
    await user.click(screen.getByRole("button", { name: "emit" }));
    expect(screen.queryByRole("status", { name: /notifications/i })).not.toBeInTheDocument();
  });
});
