import type { JSX } from "react";
import { useWaypoint } from "../wp/WaypointProvider.js";
import { useReentry } from "../wp/useReentry.js";
import type { ReentryModel } from "../wp/useReentry.js";
import { Icon } from "../wp/icons.js";
import { DecisionCard } from "./DecisionCard.js";
import { Skeleton } from "./Skeleton.js";
import t from "./typography.module.css";
import styles from "./Briefing.module.css";

// The re-entry Briefing surface (S3a): a centered modal that catches the returning human up on one
// project. It leads with the decisions that need them — each an inline, actionable DecisionCard —
// then summarizes where the agent is now, what moved, and any heads-up. The primary action acks the
// digest read cursor and closes. Driven entirely by useReentry, which owns the loading/error/ready
// states; this component is the presentation. Mount + the surface switcher land in a later slice.
export function Briefing({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}): JSX.Element {
  const state = useReentry(projectId);

  return (
    <div className={styles.overlay}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="While you were away"
      >
        {state.status === "loading" ? (
          <div className={styles.state} role="status" aria-busy="true" aria-label="Loading…">
            <span className={styles.srOnly}>Loading…</span>
            <Skeleton height={24} width="60%" radius="6px" />
            <Skeleton lines={3} height={56} radius="8px" />
          </div>
        ) : state.status === "error" ? (
          <div className={styles.state} role="alert">
            <p className={styles.errText}>Couldn’t load your briefing.</p>
            <button type="button" className={styles.retry} onClick={state.retry}>
              Retry
            </button>
          </div>
        ) : (
          <Ready model={state.model} projectId={projectId} onClose={onClose} />
        )}
      </section>
    </div>
  );
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

  const jump = (): void => {
    void ackDigest(projectId, model.seq);
    onClose();
  };

  return (
    <>
      <header className={styles.greeting}>
        <div className={t.eyebrowSm}>While you were away</div>
        <h2 className={styles.hello}>Welcome back, {model.greeting.userName}</h2>
        <p className={styles.subhead}>
          <span className={styles.project}>{model.greeting.projectName}</span> —{" "}
          {count === 0
            ? "nothing needs you right now"
            : `${count} ${count === 1 ? "decision needs" : "decisions need"} you`}
        </p>
      </header>

      <section className={styles.section} aria-label="Needs you">
        <h3 className={styles.sectionHead}>Needs you</h3>
        {count === 0 ? (
          <p className={styles.allClear}>All clear — no open decisions on this project.</p>
        ) : (
          <div className={styles.cards}>
            {model.needsYou.map((d) => (
              <DecisionCard key={d.id} decision={d} />
            ))}
          </div>
        )}
      </section>

      {model.activeWork.length > 0 ? (
        <section className={styles.section} aria-label="Where your agent is now">
          <h3 className={styles.sectionHead}>Where your agent is now</h3>
          <ul className={styles.list}>
            {model.activeWork.map((w) => (
              <li key={w.nodeId} className={styles.item}>
                {w.streamTitle !== null ? `${w.streamTitle} — ${w.nodeTitle}` : w.nodeTitle}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {model.moved.length > 0 ? (
        <section className={styles.section} aria-label="What moved">
          <h3 className={styles.sectionHead}>What moved</h3>
          <ul className={styles.list}>
            {model.moved.map((n) => (
              <li key={n.nodeId} className={styles.item}>
                {n.title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {model.headsUp.length > 0 ? (
        <section className={styles.section} aria-label="Heads up">
          <h3 className={styles.sectionHead}>Heads up</h3>
          <ul className={styles.list}>
            {model.headsUp.map((h) => (
              <li
                key={h.askId}
                className={`${styles.headsUp} ${h.kind === "danger" ? styles.danger : ""}`}
              >
                {h.prompt}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className={styles.footer}>
        <button type="button" className={styles.jump} onClick={jump}>
          <Icon name="arrowRight" size={16} />
          Jump into the session
        </button>
      </footer>
    </>
  );
}
