import type { JSX } from "react";
import { useWaypoint } from "../wp/WaypointProvider.js";
import { Icon } from "../wp/icons.js";
import { AgentPill } from "./AgentPill.js";
import type { View } from "../wp/state.js";
import styles from "./TopBar.module.css";

const VIEW_LABEL: Record<View, string> = {
  home: "All projects",
  map: "Project map",
  inbox: "Decisions",
  proposal: "Decision",
  activity: "Activity",
  settings: "Settings",
};

export interface TopBarProps {
  onBell: () => void;
}

export function TopBar({ onBell }: TopBarProps): JSX.Element {
  const { data, nav } = useWaypoint();
  const project = data.projects.find((p) => p.id === nav.project) ?? null;
  const unread = data.notifications.filter((n) => n.unread).length;

  return (
    <header className={styles.topbar}>
      {project ? (
        <div className={styles.crumb}>
          <span className={styles.glyph} style={{ background: project.color }}>
            {project.glyph}
          </span>
          <span className={styles.ct}>{project.name}</span>
          <span className={styles.slash}>/</span>
          <span className={styles.sub}>{VIEW_LABEL[nav.view]}</span>
        </div>
      ) : (
        <div className={styles.crumb}>
          <span className={styles.ct}>All projects</span>
        </div>
      )}
      <div className={styles.spacer} />
      {project ? <AgentPill agent={project.agent} tasks={project.agentTasks} prefixed /> : null}
      <span className={styles.clock}>{data.now} AM</span>
      <button
        type="button"
        className={styles.iconbtn}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        onClick={onBell}
      >
        <Icon name="bell" size={19} />
        {unread > 0 ? <span className={styles.ndot} /> : null}
      </button>
    </header>
  );
}
