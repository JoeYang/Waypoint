// A lightweight, dependency-free toast system (web-only). Surfaces transient confirmations — e.g.
// "Applied Drizzle — agent resuming" after a resolve — in a polite live region so assistive tech
// announces them without stealing focus. Each toast auto-dismisses after a timeout and can be
// dismissed manually. `useToast` degrades to a no-op outside a provider so call sites (and the
// existing Proposal/DecisionCard tests that render without a provider) stay safe.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { JSX, ReactNode } from "react";
import styles from "./ToastProvider.module.css";

export interface ToastContextValue {
  toast: (message: string) => void;
}

interface Toast {
  id: number;
  message: string;
}

/** How long a toast lingers before it auto-dismisses. */
const TOAST_TIMEOUT_MS = 4000;

// Default to a no-op so a component calling `useToast()` outside a provider never throws — the
// confirmation simply doesn't render. A dedicated provider supplies the real enqueue.
const noop: ToastContextValue = { toast: () => undefined };
const ToastContext = createContext<ToastContextValue>(noop);

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const nextId = useRef(0);
  // Track pending timers so we can clear them on unmount (no setState after teardown).
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message }]);
      const timer = setTimeout(() => dismiss(id), TOAST_TIMEOUT_MS);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className={styles.region} role="status" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} className={styles.toast}>
            <span className={styles.message}>{t.message}</span>
            <button
              type="button"
              className={styles.dismiss}
              aria-label="Dismiss notification"
              onClick={() => dismiss(t.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
