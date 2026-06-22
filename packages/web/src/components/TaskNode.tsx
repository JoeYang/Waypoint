import type { JSX } from "react";
import { Icon } from "../wp/icons.js";
import { Badge } from "./Badge.js";
import type { Task } from "../wp/types.js";
import styles from "./TaskNode.module.css";

export interface TaskNodeProps {
  task: Task;
  /** Whether this task's parked decision has been resolved (blocked → resuming). */
  resolved: boolean;
  onOpenDecision: (id: string) => void;
}

// One task on a stream lane, rendered as a connected RAIL row: a left rail cell (a vertical
// connector + a round status-node marker) and a right content cell (the name + meta). The active
// "you are here" node glows and pulses — the brightest node on the lane. A blocked task with an
// unresolved decision is the only interactive node — a button that opens the proposal; once
// resolved it flips to a non-interactive "resuming" active node. The connector above a queued
// node is dashed ("future"); solid otherwise.
export function TaskNode({ task, resolved, onOpenDecision }: TaskNodeProps): JSX.Element {
  const isResolved = task.status === "blocked" && resolved;
  const status = isResolved ? "active" : task.status;
  // The decision to open on click — only set for an unresolved blocked task that has one.
  const openId = !isResolved && task.status === "blocked" ? task.decision : undefined;
  // The "you are here" emphasis: a non-resolved active task flagged `here` pulses its node.
  const pulsing = !isResolved && task.here === true && status === "active";

  const connClassName = [styles.conn, status === "queued" && styles.future]
    .filter(Boolean)
    .join(" ");
  const markerClassName = [styles.marker, styles[status], pulsing && styles.pulse]
    .filter(Boolean)
    .join(" ");
  const cardClassName = [styles.tcard, styles[status], openId !== undefined && styles.clickable]
    .filter(Boolean)
    .join(" ");

  const body = (
    <>
      <span className={styles.tt}>{task.name}</span>
      {isResolved ? <span className={styles.resuming}>resolved → resuming</span> : null}
      {!isResolved && task.here ? (
        <span className={styles.hereTag}>
          <Icon name="user" size={11} />
          You are here
        </span>
      ) : null}
      {!isResolved && task.note && !task.here ? (
        <span className={styles.tm}>{task.note}</span>
      ) : null}
      {!isResolved && task.status === "blocked" ? (
        <span className={styles.parked}>
          <Badge variant="warning">Decision parked</Badge>
        </span>
      ) : null}
    </>
  );

  return (
    <div className={styles.tnode}>
      <span className={styles.rail} aria-hidden="true">
        <span className={markerClassName}>
          {status === "done" ? <Icon name="check" size={9} /> : null}
        </span>
        <span className={connClassName} />
      </span>
      <div className={styles.content}>
        {openId !== undefined ? (
          <button type="button" className={cardClassName} onClick={() => onOpenDecision(openId)}>
            {body}
          </button>
        ) : (
          <div className={cardClassName}>{body}</div>
        )}
      </div>
    </div>
  );
}
