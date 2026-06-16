import type { JSX } from "react";
import { Icon } from "../wp/icons.js";
import { Badge } from "./Badge.js";
import { taskIconName } from "../wp/helpers.js";
import type { Task } from "../wp/types.js";
import styles from "./TaskNode.module.css";

export interface TaskNodeProps {
  task: Task;
  /** Whether this task's parked decision has been resolved (blocked → resuming). */
  resolved: boolean;
  onOpenDecision: (id: string) => void;
}

// One node on a stream lane. A blocked task with an unresolved decision is the only
// interactive node — it's a button that opens the proposal. Once resolved it flips to a
// non-interactive "resuming" node. The leading connector is dashed for not-yet-started work.
export function TaskNode({ task, resolved, onOpenDecision }: TaskNodeProps): JSX.Element {
  const isResolved = task.status === "blocked" && resolved;
  const status = isResolved ? "active" : task.status;
  // The decision to open on click — only set for an unresolved blocked task that has one.
  const openId = !isResolved && task.status === "blocked" ? task.decision : undefined;

  const connClassName = [styles.conn, status === "queued" && styles.future]
    .filter(Boolean)
    .join(" ");
  const cardClassName = [styles.tcard, styles[status]].join(" ");

  const body = (
    <>
      <span className={styles.tt}>
        <Icon name={taskIconName[status]} size={15} />
        {task.name}
      </span>
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
      <span className={connClassName} aria-hidden="true" />
      {openId !== undefined ? (
        <button type="button" className={cardClassName} onClick={() => onOpenDecision(openId)}>
          {body}
        </button>
      ) : (
        <div className={cardClassName}>{body}</div>
      )}
    </div>
  );
}
