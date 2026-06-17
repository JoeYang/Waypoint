import { useMemo, useState, type JSX } from "react";
import { useWaypoint } from "../wp/WaypointProvider.js";
import { Badge, type BadgeVariant } from "./Badge.js";
import { TaskNode } from "./TaskNode.js";
import { streamProgress } from "../wp/helpers.js";
import type { Stream, StreamStatus } from "../wp/types.js";
import t from "./typography.module.css";
import styles from "./ProjectMap.module.css";

// Stream status → badge variant + label (ported from the handoff's streamStatusBadge).
const STREAM_BADGE: Record<StreamStatus, { variant: BadgeVariant; label: string }> = {
  done: { variant: "success", label: "Done" },
  active: { variant: "accent", label: "In progress" },
  blocked: { variant: "warning", label: "Blocked" },
  queued: { variant: "neutral", label: "Queued" },
};

// Stable empty default for the hook so it can run before the no-project early return.
const EMPTY_STREAMS: Stream[] = [];

const LEGEND: { key: StreamStatus; label: string }[] = [
  { key: "done", label: "Done" },
  { key: "active", label: "In progress" },
  { key: "blocked", label: "Decision parked" },
  { key: "queued", label: "Queued" },
];

// Tracks which lanes are expanded. Done lanes start collapsed (their task detail rarely needs
// scanning); every other lane starts expanded. The Set holds only ids whose expanded state has
// been toggled away from that default, so the default is computed per render from `streams`.
function useLaneExpansion(streams: Stream[]): {
  isExpanded: (s: Stream) => boolean;
  toggle: (id: string) => void;
} {
  // Toggled ids — present means "flipped from the status-derived default".
  const [toggled, setToggled] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (id: string): void =>
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // Memoize the default lookup so identity is stable across renders for the same stream list.
  const defaultExpanded = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const s of streams) map.set(s.id, s.status !== "done");
    return map;
  }, [streams]);
  const isExpanded = (s: Stream): boolean => {
    const base = defaultExpanded.get(s.id) ?? true;
    return toggled.has(s.id) ? !base : base;
  };
  return { isExpanded, toggle };
}

// The per-project map: each parallel stream is a horizontal lane of task nodes. A single
// approval never stalls the project — blocked streams park while the others advance.
export function ProjectMap(): JSX.Element {
  const { data, nav, resolved, openDecision } = useWaypoint();
  const project = data.projects.find((p) => p.id === nav.project);
  const { isExpanded, toggle } = useLaneExpansion(project?.streams ?? EMPTY_STREAMS);

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
        const expanded = isExpanded(s);
        const trackId = `lane-track-${s.id}`;
        return (
          <div key={s.id} className={styles.lane}>
            <button
              type="button"
              className={styles.laneHead}
              aria-expanded={expanded}
              aria-controls={trackId}
              onClick={() => toggle(s.id)}
            >
              <span className={styles.lname}>{s.name}</span>
              <Badge variant={badge.variant}>{badge.label}</Badge>
              <span className={styles.lspace} />
              <span className={styles.lmeta}>
                {pr.done}/{pr.total} done
              </span>
            </button>
            {expanded ? (
              <div id={trackId} className={styles.laneTrack}>
                {s.tasks.map((task, i) => (
                  <TaskNode
                    key={i}
                    task={task}
                    resolved={task.decision !== undefined && resolved[task.decision] !== undefined}
                    onOpenDecision={openDecision}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
