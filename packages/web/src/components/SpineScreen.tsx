import { useCallback, useEffect, useState } from "react";
import type { AnswerRequest, ProjectProgress } from "@waypoint/shared";
import { useWaypointStream, type WaypointStreamOptions } from "../inbox/useWaypointStream.js";
import { answerAsk, fetchProgress, ApiError } from "../api/client.js";
import { Spine } from "./Spine.js";
import styles from "./InboxScreen.module.css";

interface SpineScreenProps {
  projectId: string;
  baseUrl?: string;
  streamOptions?: WaypointStreamOptions; // injected in tests (socketFactory, wsUrl)
}

// The container for the project spine (the home). It reuses the inbox WS stream purely as a
// LIVENESS SIGNAL — when the stream's seq advances (any committed mutation), the spine
// refetches /progress. There is no separate progress feed. Answers go through the same
// optimistic-version write as the inbox; the card stays "working" until the refetch drops it.
export function SpineScreen({
  projectId,
  baseUrl = "",
  streamOptions,
}: SpineScreenProps): React.JSX.Element {
  const { status, seq, reconnect } = useWaypointStream(projectId, { baseUrl, ...streamOptions });
  const [progress, setProgress] = useState<ProjectProgress | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [working, setWorking] = useState<ReadonlySet<string>>(new Set());
  const [answerError, setAnswerError] = useState<string | null>(null);

  // Fetch the spine on mount, on a manual retry, and whenever the live seq advances.
  useEffect(() => {
    let cancelled = false;
    fetchProgress(baseUrl, projectId)
      .then((p) => {
        if (!cancelled) {
          setProgress(p);
          setLoadError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(
            error instanceof ApiError ? error.message : "Couldn't load the project spine.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [baseUrl, projectId, seq, reloadKey]);

  // Working self-heals: drop any id whose ask no longer appears after a refetch.
  useEffect(() => {
    if (progress === null) return;
    const present = new Set(
      progress.goals
        .flatMap((g) => g.plans)
        .flatMap((p) => p.tasks)
        .flatMap((t) => t.asks)
        .map((a) => a.askId),
    );
    setWorking((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set([...prev].filter((id) => present.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [progress]);

  const handleAnswer = useCallback(
    async (askId: string, req: AnswerRequest) => {
      setAnswerError(null);
      setWorking((prev) => new Set(prev).add(askId));
      try {
        await answerAsk(baseUrl, projectId, askId, req);
        // Leave the card "working"; the WS signal triggers a refetch that drops it for real.
      } catch (error) {
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

  if (progress === null) {
    if (loadError !== null) {
      return (
        <div className={styles.state} role="alert">
          <p className="lead">Couldn't load the project.</p>
          <button
            type="button"
            className={styles.retry}
            onClick={() => {
              setLoadError(null);
              setReloadKey((k) => k + 1);
              reconnect();
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return (
      <div className={styles.state} role="status" aria-live="polite">
        <p className="muted">Loading the project…</p>
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
      <Spine progress={progress} workingAskIds={working} onAnswer={handleAnswer} />
    </div>
  );
}
