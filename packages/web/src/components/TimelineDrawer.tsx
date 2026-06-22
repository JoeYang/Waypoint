import type { JSX } from "react";
import type { StoryEntry } from "@waypoint/shared";
import { useWaypoint } from "../wp/WaypointProvider.js";
import { useReentry } from "../wp/useReentry.js";
import type { ReentryModel } from "../wp/useReentry.js";
import { Icon } from "../wp/icons.js";
import { DecisionCard } from "./DecisionCard.js";
import { Skeleton } from "./Skeleton.js";
import styles from "./TimelineDrawer.module.css";

// The re-entry Timeline surface (S3c): a right-side drawer that replays the session for a returning
// human. It pins the decisions that still need them at the top (the same actionable DecisionCard),
// then plays back the project story oldest-first as a chronological feed — each entry threaded under
// its node, stamped with a time and an actor — with a "New since you left" divider marking the first
// entry past their last-seen cursor. The primary action acks the digest cursor and closes. Driven
// entirely by useReentry (loading/error/ready); this component is presentation. Mount + the surface
// switcher land in S3d.
export function TimelineDrawer({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}): JSX.Element {
  const state = useReentry(projectId);

  return (
    <aside
      className={styles.drawer}
      role="dialog"
      aria-modal="true"
      aria-label="While you were away"
    >
      {state.status === "loading" ? (
        <div className={styles.state} role="status" aria-busy="true" aria-label="Loading…">
          <span className={styles.srOnly}>Loading…</span>
          <Skeleton height={24} width="70%" radius="6px" />
          <Skeleton lines={5} height={40} radius="8px" />
        </div>
      ) : state.status === "error" ? (
        <div className={styles.state} role="alert">
          <p className={styles.errText}>Couldn’t load your timeline.</p>
          <button type="button" className={styles.retry} onClick={state.retry}>
            Retry
          </button>
        </div>
      ) : (
        <Ready model={state.model} projectId={projectId} onClose={onClose} />
      )}
    </aside>
  );
}

// The first entry whose seq is past the cursor is where "new since you left" begins. -1 means no
// entry is newer than the cursor (the divider is omitted entirely).
function firstNewIndex(timeline: readonly StoryEntry[], sinceSeq: number): number {
  return timeline.findIndex((e) => e.seq > sinceSeq);
}

// A stable HH:MM label for an entry's epoch-ms timestamp (24-hour, zero-padded).
function timeLabel(at: number): string {
  const d = new Date(at);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function Ready({
  model,
  projectId,
  onClose,
}: {
  model: ReentryModel;
  projectId: string;
  onClose: () => void;
}): JSX.Element {
  const { ackDigest } = useWaypoint();
  const count = model.needsYou.length;
  const newAt = firstNewIndex(model.timeline, model.sinceSeq);

  const enter = (): void => {
    void ackDigest(projectId, model.seq);
    onClose();
  };

  return (
    <>
      <header className={styles.header}>
        <h2 className={styles.headTitle}>
          Needs you <span className={styles.count}>· {count}</span>
        </h2>
        {count === 0 ? (
          <p className={styles.allClear}>All clear — no open decisions on this project.</p>
        ) : (
          <div className={styles.cards}>
            {model.needsYou.map((d) => (
              <DecisionCard key={d.id} decision={d} />
            ))}
          </div>
        )}
      </header>

      <section className={styles.replay} aria-label="Session replay">
        <h3 className={styles.replayHead}>Session replay</h3>
        {model.timeline.length === 0 ? (
          <p className={styles.empty}>Nothing happened while you were away.</p>
        ) : (
          <ol className={styles.feed}>
            {model.timeline.map((entry, i) => (
              <li key={entry.seq} className={styles.entryItem}>
                {i === newAt ? (
                  <div className={styles.divider} role="separator">
                    New since you left
                  </div>
                ) : null}
                <article className={styles.entry}>
                  <time className={styles.time}>{timeLabel(entry.at)}</time>
                  <div className={styles.entryBody}>
                    <span className={styles.label}>{entry.summary ?? entry.verb}</span>
                    {entry.nodeTitle !== null ? (
                      <span className={styles.node}>{entry.nodeTitle}</span>
                    ) : null}
                    {entry.actorLabel !== null ? (
                      <span className={styles.actor}>{entry.actorLabel}</span>
                    ) : null}
                  </div>
                </article>
              </li>
            ))}
          </ol>
        )}
      </section>

      <footer className={styles.footer}>
        <button type="button" className={styles.enter} onClick={enter}>
          <Icon name="arrowRight" size={16} />
          Enter session
        </button>
      </footer>
    </>
  );
}
