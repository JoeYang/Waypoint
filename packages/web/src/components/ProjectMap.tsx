import { useCallback, useMemo, useState, type JSX } from "react";
import { useWaypoint } from "../wp/WaypointProvider.js";
import { Badge, type BadgeVariant } from "./Badge.js";
import { TaskNode } from "./TaskNode.js";
import { Icon } from "../wp/icons.js";
import { streamProgress } from "../wp/helpers.js";
import type { Stream, StreamStatus } from "../wp/types.js";
import t from "./typography.module.css";
import styles from "./ProjectMap.module.css";

// A stable DOM id for the "you are here" task node, so the jump control can scroll it into view.
const HERE_NODE_ID = "map-here-task";

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
  expand: (id: string) => void;
} {
  // Toggled ids — present means "flipped from the status-derived default".
  const [toggled, setToggled] = useState<ReadonlySet<string>>(() => new Set());
  // Memoize the default lookup so identity is stable across renders for the same stream list.
  const defaultExpanded = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const s of streams) map.set(s.id, s.status !== "done");
    return map;
  }, [streams]);
  const toggle = useCallback((id: string): void => {
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  // Force a lane open regardless of its default/toggle state (used by the jump control).
  const expand = useCallback(
    (id: string): void => {
      const base = defaultExpanded.get(id) ?? true;
      setToggled((prev) => {
        // Expanded means base XOR toggled-presence is true. If already expanded, no change;
        // otherwise flip toggled so the lane reads as expanded.
        const isOpen = prev.has(id) ? !base : base;
        if (isOpen) return prev;
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [defaultExpanded],
  );
  const isExpanded = (s: Stream): boolean => {
    const base = defaultExpanded.get(s.id) ?? true;
    return toggled.has(s.id) ? !base : base;
  };
  return { isExpanded, toggle, expand };
}

// The per-project map: each parallel stream is a horizontal lane of task nodes. A single
// approval never stalls the project — blocked streams park while the others advance.
export function ProjectMap(): JSX.Element {
  const { data, nav, resolved, openDecision } = useWaypoint();
  const project = data.projects.find((p) => p.id === nav.project);
  const streams = project?.streams ?? EMPTY_STREAMS;
  const { isExpanded, toggle, expand } = useLaneExpansion(streams);

  // The stream that holds the "you are here" task, if any — the jump target.
  const hereStreamId = useMemo(
    () => streams.find((s) => s.tasks.some((task) => task.here === true))?.id,
    [streams],
  );

  // Force the here task's lane open, then scroll the node into view. `scrollIntoView` is guarded
  // for environments (jsdom) that do not implement it.
  const jumpToHere = useCallback((): void => {
    if (hereStreamId === undefined) return;
    expand(hereStreamId);
    // Defer the scroll until after the lane has re-rendered expanded.
    requestAnimationFrame(() => {
      const el = document.getElementById(HERE_NODE_ID);
      el?.scrollIntoView?.({ block: "center" });
    });
  }, [expand, hereStreamId]);

  if (!project) {
    return (
      <div className={t.viewInner}>
        <p className={styles.empty}>
          No project selected — pick one from the sidebar to see its map.
        </p>
      </div>
    );
  }

  // Map-level tallies: live edits = active tasks, parked = blocked tasks, across all streams.
  let liveEdits = 0;
  let parked = 0;
  for (const s of project.streams) {
    for (const task of s.tasks) {
      if (task.status === "active") liveEdits += 1;
      else if (task.status === "blocked") parked += 1;
    }
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

      <div className={styles.summary} role="group" aria-label="Map summary">
        <span className={styles.stat}>
          <strong>{project.streams.length}</strong> streams
        </span>
        <span className={styles.statDot} aria-hidden="true" />
        <span className={styles.stat}>
          <strong>{liveEdits}</strong> live edits
        </span>
        <span className={styles.statDot} aria-hidden="true" />
        <span className={styles.stat}>
          <strong>{parked}</strong> parked
        </span>
        <span className={styles.lspace} />
        {hereStreamId !== undefined ? (
          <button type="button" className={styles.jump} onClick={jumpToHere}>
            <Icon name="user" size={13} />
            Jump to where you left off
          </button>
        ) : null}
      </div>

      {project.streams.map((s) => {
        const pr = streamProgress(s);
        const badge = STREAM_BADGE[s.status];
        const expanded = isExpanded(s);
        const trackId = `lane-track-${s.id}`;
        // A complete lane: explicitly done, or every task done (total > 0).
        const complete = s.status === "done" || (pr.total > 0 && pr.done === pr.total);
        // A collapsed complete lane reads as "all green" rather than just a closed header.
        const showAllGreen = !expanded && complete;
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
              <span
                className={styles.meter}
                role="progressbar"
                aria-label={`${s.name} progress`}
                aria-valuenow={pr.done}
                aria-valuemin={0}
                aria-valuemax={pr.total}
              >
                <span
                  className={styles.meterFill}
                  style={{ ["--pct" as string]: `${pr.pct}%` }}
                  aria-hidden="true"
                />
              </span>
              <span className={styles.lspace} />
              {showAllGreen ? (
                <span className={styles.allGreen}>
                  <Icon name="check" size={12} />
                  {pr.done}/{pr.total} · all green
                </span>
              ) : (
                <span className={styles.lmeta}>
                  {pr.done}/{pr.total} done
                </span>
              )}
            </button>
            {expanded ? (
              <div id={trackId} className={styles.laneTrack}>
                {s.tasks.map((task, i) => (
                  <TaskNode
                    key={i}
                    id={task.here === true ? HERE_NODE_ID : undefined}
                    task={task}
                    decision={project.decisions.find((d) => d.id === task.decision)}
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
