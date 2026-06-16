import { useCallback, useEffect, useState } from "react";
import type { AnswerRequest } from "@waypoint/shared";
import { useWaypointStream, type WaypointStreamOptions } from "../inbox/useWaypointStream.js";
import { answerAsk, ApiError } from "../api/client.js";
import { InboxList } from "./InboxList.js";
import styles from "./InboxScreen.module.css";

interface InboxScreenProps {
  projectId: string;
  baseUrl?: string;
  streamOptions?: WaypointStreamOptions; // injected in tests (socketFactory, wsUrl)
}

// The container for the live inbox. Drives the stream hook, owns the three async states
// (loading / error / list, with the list rendering its own empty state), and the answer
// write. Answering marks a card "working"; the real removal arrives from the WS delta, so
// the queue re-ranks from the server truth rather than an optimistic guess.
export function InboxScreen({
  projectId,
  baseUrl = "",
  streamOptions,
}: InboxScreenProps): React.JSX.Element {
  const { status, items, seq, reconnect } = useWaypointStream(projectId, {
    baseUrl,
    ...streamOptions,
  });
  const [working, setWorking] = useState<ReadonlySet<string>>(new Set());
  const [answerError, setAnswerError] = useState<string | null>(null);

  // Reconcile the working set against the live items: once a card leaves the inbox (its
  // delta removed it), it is no longer "working". This self-heals if an answer's delta is
  // delayed — the next snapshot/delta is the source of truth.
  useEffect(() => {
    setWorking((prev) => {
      if (prev.size === 0) return prev;
      const present = new Set(items.map((i) => i.askId));
      const next = new Set([...prev].filter((id) => present.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  const handleAnswer = useCallback(
    async (askId: string, req: AnswerRequest) => {
      setAnswerError(null);
      setWorking((prev) => new Set(prev).add(askId));
      try {
        await answerAsk(baseUrl, projectId, askId, req);
        // Leave the card "working"; the WS delta removes it for real.
      } catch (error) {
        // Failed write: drop "working" so the control returns, and surface why.
        setWorking((prev) => {
          const next = new Set(prev);
          next.delete(askId);
          return next;
        });
        setAnswerError(error instanceof ApiError ? error.message : "Could not submit your answer.");
      }
    },
    [baseUrl, projectId],
  );

  // "Loaded" = at least one snapshot/delta applied (seq advances past its -1 sentinel).
  const loaded = seq >= 0;
  if (!loaded) {
    if (status === "error" || status === "reconnecting") {
      return (
        <div className={styles.state} role="alert">
          <p className="lead">Couldn't reach the inbox.</p>
          <button type="button" className={styles.retry} onClick={reconnect}>
            Retry
          </button>
        </div>
      );
    }
    return (
      <div className={styles.state} role="status" aria-live="polite">
        <p className="muted">Loading the inbox…</p>
      </div>
    );
  }

  return (
    <div>
      {answerError !== null && (
        <p className={styles.error} role="alert">
          {answerError}
        </p>
      )}
      {status === "reconnecting" && (
        <p className={styles.reconnecting} role="status" aria-live="polite">
          Reconnecting…
        </p>
      )}
      <InboxList items={items} workingAskIds={working} onAnswer={handleAnswer} />
    </div>
  );
}
