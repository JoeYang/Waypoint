import type { JSX } from "react";
import type { AgentStatus } from "../wp/types.js";
import styles from "./AgentPill.module.css";

export interface AgentPillProps {
  agent: AgentStatus;
  tasks?: number;
  // `prefixed` renders "Agent working · N tasks" / "Agent idle" (top bar); the compact form
  // renders "Working" / "Idle" (home cards).
  prefixed?: boolean;
}

export function AgentPill({ agent, tasks, prefixed = false }: AgentPillProps): JSX.Element {
  const idle = agent === "idle";
  const className = idle ? `${styles.pill} ${styles.idle}` : styles.pill;
  return (
    <span className={className}>
      <span className={styles.dot} />
      {idle ? (
        prefixed ? (
          "Agent idle"
        ) : (
          "Idle"
        )
      ) : prefixed ? (
        <>
          Agent working <span className={styles.mono}>· {tasks} tasks</span>
        </>
      ) : (
        "Working"
      )}
    </span>
  );
}
