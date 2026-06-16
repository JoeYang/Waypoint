import type { JSX } from "react";
import { useWaypoint } from "../wp/WaypointProvider.js";
import { Icon, type IconName } from "../wp/icons.js";
import type { ActivityKind } from "../wp/types.js";
import t from "./typography.module.css";
import styles from "./Activity.module.css";

// Done and edit events carry a glyph; parked and you events are plain colour-coded dots.
const DOT_ICON: Partial<Record<ActivityKind, IconName>> = { done: "check", edit: "file" };

// The append-only morning timeline: events grouped by time, each with a kind-coded dot, the
// stream it touched, and a sub-line. Read-only — the audit view of what the agent did.
export function Activity(): JSX.Element {
  const { data, nav } = useWaypoint();
  const project = data.projects.find((p) => p.id === nav.project);

  if (!project) {
    return (
      <div className={t.viewInner}>
        <p className={styles.empty}>
          No project selected — pick one from the sidebar to see its activity.
        </p>
      </div>
    );
  }

  return (
    <div className={`${t.viewInner} ${t.fadeIn}`}>
      <div className={styles.head}>
        <div className={t.eyebrowSm}>Activity</div>
        <h1 className={t.hPage} style={{ marginTop: 6 }}>
          What happened this morning
        </h1>
      </div>

      <div className={styles.timeline}>
        {project.activity.map((g, gi) => (
          <div key={gi} className={styles.tlGroup}>
            <div className={styles.tlTime}>{g.time}</div>
            {g.items.map((it, ii) => {
              const icon = DOT_ICON[it.kind];
              return (
                <div key={ii} className={styles.tlItem}>
                  <span className={`${styles.dot} ${styles[it.kind]}`} aria-hidden="true">
                    {icon ? <Icon name={icon} size={10} /> : null}
                  </span>
                  <div className={styles.tlBody}>
                    <div className={styles.tx}>
                      {it.text}{" "}
                      {it.stream && it.stream !== "Session" ? (
                        <span className={styles.streamTag}>{it.stream}</span>
                      ) : null}
                    </div>
                    {it.sub ? <div className={styles.sub}>{it.sub}</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
