import type { JSX } from "react";
import { useWaypoint } from "../wp/WaypointProvider.js";
import { Badge, type BadgeVariant } from "./Badge.js";
import { TaskNode } from "./TaskNode.js";
import { streamProgress } from "../wp/helpers.js";
import type { StreamStatus } from "../wp/types.js";
import t from "./typography.module.css";
import styles from "./ProjectMap.module.css";

// Stream status → badge variant + label (ported from the handoff's streamStatusBadge).
const STREAM_BADGE: Record<StreamStatus, { variant: BadgeVariant; label: string }> = {
  done: { variant: "success", label: "Done" },
  active: { variant: "accent", label: "In progress" },
  blocked: { variant: "warning", label: "Blocked" },
  queued: { variant: "neutral", label: "Queued" },
};

const LEGEND: { key: StreamStatus; label: string }[] = [
  { key: "done", label: "Done" },
  { key: "active", label: "In progress" },
  { key: "blocked", label: "Decision parked" },
  { key: "queued", label: "Queued" },
];

// The per-project map: each parallel stream is a horizontal lane of task nodes. A single
// approval never stalls the project — blocked streams park while the others advance.
export function ProjectMap(): JSX.Element {
  const { data, nav, resolved, openDecision } = useWaypoint();
  const project = data.projects.find((p) => p.id === nav.project);

  if (!project) {
    return (
      <div className={t.viewInner}>
        <p className={styles.empty}>
          No project selected — pick one from the sidebar to see its map.
        </p>
      </div>
    );
  }

  return (
    <div className={`${t.viewInner} ${t.viewInnerWide} ${t.fadeIn}`}>
      <div className={t.viewHead}>
        <div className={t.vhTitle}>
          <div className={t.eyebrowSm}>{project.streams.length} parallel streams</div>
          <h1 className={t.hPage} style={{ marginTop: 6 }}>
            Project map
          </h1>
        </div>
        <div className={t.vhSpacer} />
        <div className={styles.legend} role="group" aria-label="Map legend">
          {LEGEND.map((l) => (
            <span key={l.key} className={styles.li}>
              <span className={`${styles.sw} ${styles[l.key]}`} aria-hidden="true" />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <p className={styles.intro}>
        Each stream advances on its own. When one hits a decision it can&apos;t make, the agent
        parks it and keeps the others moving — so a single approval never stalls the whole project.
      </p>

      {project.streams.map((s) => {
        const pr = streamProgress(s);
        const badge = STREAM_BADGE[s.status];
        return (
          <div key={s.id} className={styles.lane}>
            <div className={styles.laneHead}>
              <span className={styles.lname}>{s.name}</span>
              <Badge variant={badge.variant}>{badge.label}</Badge>
              <span className={styles.lspace} />
              <span className={styles.lmeta}>
                {pr.done}/{pr.total} done
              </span>
            </div>
            <div className={styles.laneTrack}>
              {s.tasks.map((task, i) => (
                <TaskNode
                  key={i}
                  task={task}
                  resolved={task.decision !== undefined && resolved[task.decision] !== undefined}
                  onOpenDecision={openDecision}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
