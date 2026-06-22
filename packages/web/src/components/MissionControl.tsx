import type { CSSProperties, JSX } from "react";
import { useWaypoint } from "../wp/WaypointProvider.js";
import { useReentry } from "../wp/useReentry.js";
import type { ReentryModel } from "../wp/useReentry.js";
import { Icon } from "../wp/icons.js";
import { DecisionCard } from "./DecisionCard.js";
import type { Stream } from "../wp/types.js";
import styles from "./MissionControl.module.css";

// The re-entry Mission Control surface (S3b): a full-screen takeover that catches the returning
// human up on one project at once. A top bar greets them and offers an escape ("Skip to session");
// a 3-column deck leads with the decisions that need them (inline, actionable DecisionCards) +
// heads-up, then where things stand now (active work + per-stream progress), then what moved while
// they were away; a footer stat strip and a primary "Enter session" (acks the digest cursor, then
// closes). Driven by useReentry (loading/error/ready); per-stream progress comes from the live
// project snapshot. Mount + the surface switcher land in S3c.
export function MissionControl({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}): JSX.Element {
  const state = useReentry(projectId);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="While you were away"
    >
      {state.status === "loading" ? (
        <div className={styles.state}>
          <p className={styles.dim}>Catching you up…</p>
        </div>
      ) : state.status === "error" ? (
        <div className={styles.state} role="alert">
          <p className={styles.errText}>Couldn’t load your mission control.</p>
          <button type="button" className={styles.retry} onClick={state.retry}>
            Retry
          </button>
        </div>
      ) : (
        <Ready model={state.model} projectId={projectId} onClose={onClose} />
      )}
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
  const { data, ackDigest } = useWaypoint();
  const streams = data.projects.find((p) => p.id === projectId)?.streams ?? [];
  const needs = model.needsYou.length;

  const enter = (): void => {
    void ackDigest(projectId, model.seq);
    onClose();
  };

  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.greeting}>
          <h2 className={styles.hello}>Welcome back, {model.greeting.userName}</h2>
          <p className={styles.project}>
            <span className={styles.projectName}>{model.greeting.projectName}</span> — while you
            were away
          </p>
        </div>
        <button type="button" className={styles.skip} onClick={onClose}>
          Skip to session
        </button>
      </header>

      <div className={styles.deck}>
        <section className={styles.column} aria-label="Needs you — act here">
          <h3 className={styles.colHead}>Needs you — act here</h3>
          {needs === 0 ? (
            <p className={styles.allClear}>All clear — no open decisions on this project.</p>
          ) : (
            <div className={styles.cards}>
              {model.needsYou.map((d) => (
                <DecisionCard key={d.id} decision={d} />
              ))}
            </div>
          )}

          <h4 className={styles.subHead}>Heads up</h4>
          {model.headsUp.length === 0 ? (
            <p className={styles.empty}>Nothing flagged.</p>
          ) : (
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
          )}
        </section>

        <section className={styles.column} aria-label="Where things stand now">
          <h3 className={styles.colHead}>Where things stand now</h3>
          {model.activeWork.length === 0 ? (
            <p className={styles.empty}>No agents working right now.</p>
          ) : (
            <ul className={styles.list}>
              {model.activeWork.map((w) => (
                <li key={w.nodeId} className={styles.item}>
                  {w.streamTitle !== null ? `${w.streamTitle} — ${w.nodeTitle}` : w.nodeTitle}
                </li>
              ))}
            </ul>
          )}

          <h4 className={styles.subHead}>Streams</h4>
          {streams.length === 0 ? (
            <p className={styles.empty}>No streams yet.</p>
          ) : (
            <ul className={styles.streams}>
              {streams.map((s) => (
                <StreamProgress key={s.id} stream={s} />
              ))}
            </ul>
          )}
        </section>

        <section className={styles.column} aria-label="While you were away">
          <h3 className={styles.colHead}>While you were away</h3>
          {model.moved.length === 0 ? (
            <p className={styles.empty}>Nothing shipped while you were away.</p>
          ) : (
            <ul className={styles.list}>
              {model.moved.map((n) => (
                <li key={n.nodeId} className={styles.item}>
                  {n.title}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <footer className={styles.footer}>
        <div className={styles.stats}>
          <Stat n={needs} label="need you" />
          <Stat n={model.activeWork.length} label="agents live" />
          <Stat n={model.moved.length} label="shipped while away" />
          <Stat n={model.headsUp.length} label="to check" />
        </div>
        <button type="button" className={styles.enter} onClick={enter}>
          <Icon name="arrowRight" size={16} />
          Enter session
        </button>
      </footer>
    </>
  );
}

function Stat({ n, label }: { n: number; label: string }): JSX.Element {
  return (
    <div className={styles.stat}>
      <span className={styles.statNum}>{n}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function StreamProgress({ stream }: { stream: Stream }): JSX.Element {
  const total = stream.tasks.length;
  const done = stream.tasks.filter((t) => t.status === "done").length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const fill: CSSProperties = { width: `${pct}%` };

  return (
    <li className={styles.stream}>
      <div className={styles.streamRow}>
        <span className={styles.streamName}>{stream.name}</span>
        <span className={styles.streamCount}>
          {done}/{total}
        </span>
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={stream.name}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className={styles.fill} style={fill} />
      </div>
    </li>
  );
}
