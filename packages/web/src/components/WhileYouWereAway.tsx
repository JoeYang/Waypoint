import { useCallback, useEffect, useState, type JSX } from "react";
import type { Digest, StoryResponse } from "@waypoint/shared";
import { useWaypoint } from "../wp/WaypointProvider.js";
import t from "./typography.module.css";
import styles from "./WhileYouWereAway.module.css";

// The re-entry briefing (slice 3): a dismissible banner atop the spine summarizing what changed
// since the human's last visit — what shipped, what is newly blocked, and what is waiting on
// them — with an inline threaded story. Dismissing acks the read cursor so it won't reappear for
// the same window. Handles all four states: loading, error (with retry), empty (renders nothing),
// and content.
export function WhileYouWereAway(): JSX.Element | null {
  const { nav, digest, ackDigest, story, navigate } = useWaypoint();
  const projectId = nav.project;

  const [data, setData] = useState<Digest | null>(null);
  const [error, setError] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [storyData, setStoryData] = useState<StoryResponse | null>(null);
  const [showStory, setShowStory] = useState(false);

  useEffect(() => {
    if (projectId === null) return;
    setData(null);
    setError(false);
    setDismissed(false);
    setStoryData(null);
    setShowStory(false);
    let active = true;
    digest(projectId).then(
      (d) => {
        if (active) setData(d);
      },
      () => {
        if (active) setError(true);
      },
    );
    return () => {
      active = false;
    };
  }, [projectId, digest, reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  if (projectId === null || dismissed) return null;

  if (error) {
    return (
      <section className={styles.banner} role="alert" aria-label="While you were away">
        <p className={styles.errText}>Couldn’t load your while-you-were-away digest.</p>
        <button type="button" className={styles.action} onClick={retry}>
          Retry
        </button>
      </section>
    );
  }

  if (data === null) {
    return (
      <section className={styles.banner} aria-busy="true" aria-label="While you were away">
        <p className={styles.dim}>Catching you up…</p>
      </section>
    );
  }

  const empty =
    data.shipped.length === 0 && data.newlyBlocked.length === 0 && data.waiting.length === 0;
  if (empty) return null; // nothing changed since last visit — no banner at all

  const dismiss = (): void => {
    setDismissed(true);
    void ackDigest(projectId, data.seq);
  };
  const loadStory = (): void => {
    setShowStory(true);
    story(projectId).then(setStoryData, () => setStoryData(null));
  };

  return (
    <section className={`${styles.banner} ${t.fadeIn}`} aria-label="While you were away">
      <div className={styles.head}>
        <div className={t.eyebrowSm}>While you were away</div>
        <button
          type="button"
          className={styles.action}
          onClick={dismiss}
          aria-label="Dismiss the while-you-were-away digest"
        >
          Dismiss
        </button>
      </div>

      <div className={styles.buckets}>
        <Bucket label="Shipped" count={data.shipped.length}>
          {data.shipped.map((n) => (
            <li key={n.nodeId} className={styles.item}>
              {n.title}
            </li>
          ))}
        </Bucket>
        <Bucket label="Newly blocked" count={data.newlyBlocked.length}>
          {data.newlyBlocked.map((n) => (
            <li key={n.nodeId} className={styles.item}>
              {n.title}
            </li>
          ))}
        </Bucket>
        <Bucket label="Waiting on you" count={data.waiting.length}>
          {data.waiting.map((a) => (
            <li key={a.askId} className={styles.item}>
              {a.nodeTitle} <span className={styles.blast}>blocks {a.blastRadius}</span>
            </li>
          ))}
        </Bucket>
      </div>

      {showStory ? (
        <ol className={styles.story} aria-label="Project story">
          {(storyData?.entries ?? []).map((e) => (
            <li key={e.seq} className={styles.storyEntry}>
              <span className={styles.actor}>{e.actorLabel ?? "you"}</span> {verbText(e.verb)}{" "}
              <button
                type="button"
                className={styles.nodeLink}
                onClick={() => navigate({ view: "map" })}
              >
                {e.nodeTitle ?? e.nodeId}
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <button type="button" className={styles.action} onClick={loadStory}>
          View story
        </button>
      )}
    </section>
  );
}

function Bucket({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className={styles.bucket}>
      <div className={styles.bucketHead}>
        {label} <span className={styles.count}>{count}</span>
      </div>
      <ul className={styles.list}>{children}</ul>
    </div>
  );
}

// Human-readable verb for the story line (the event summary carries the detail).
function verbText(verb: string): string {
  switch (verb) {
    case "node.created":
      return "created";
    case "node.transitioned":
      return "moved";
    case "ask.parked":
      return "parked a decision on";
    case "ask.answered":
      return "answered on";
    case "ask.assumed":
      return "assumed on";
    case "ask.confirmed":
      return "confirmed on";
    case "ask.overturned":
      return "overturned on";
    case "dependency.added":
      return "linked";
    default:
      return "touched";
  }
}
