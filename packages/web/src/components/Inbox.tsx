import { useState, type JSX } from "react";
import { useWaypoint } from "../wp/WaypointProvider.js";
import { Icon } from "../wp/icons.js";
import { Badge } from "./Badge.js";
import { RiskBadge } from "./RiskBadge.js";
import { RevBadge } from "./RevBadge.js";
import type { Decision, FilterKind } from "../wp/types.js";
import t from "./typography.module.css";
import styles from "./Inbox.module.css";

const FILTERS: { key: FilterKind; label: string }[] = [
  { key: "all", label: "All" },
  { key: "blocking", label: "Blocking" },
  { key: "non-blocking", label: "Non-blocking" },
];

// A discriminated FilterKind drives a total predicate — this is the fix for the prototype's
// "non" bug, where the chip set state to a value the predicate never matched.
const matchesFilter = (d: Decision, filter: FilterKind): boolean => {
  switch (filter) {
    case "all":
      return true;
    case "blocking":
      return d.blocking;
    case "non-blocking":
      return !d.blocking;
  }
};

// The first sentence of the context, appended after the recommendation.
const recLine = (context: string): string => `${context.split(".")[0] ?? context}.`;

// The per-project decision queue. A queue, not an interruption: the agent keeps working while
// these wait. Rows open the proposal; chips filter; two distinct empty states.
export function Inbox(): JSX.Element {
  const { data, nav, resolved, openDecision } = useWaypoint();
  const [filter, setFilter] = useState<FilterKind>("all");
  const project = data.projects.find((p) => p.id === nav.project);

  if (!project) {
    return (
      <div className={t.viewInner}>
        <p className={styles.empty}>
          No project selected — pick one from the sidebar to see its inbox.
        </p>
      </div>
    );
  }

  const waiting = project.decisions.filter((d) => resolved[d.id] === undefined);
  const decisions = waiting.filter((d) => matchesFilter(d, filter));

  return (
    <div className={`${t.viewInner} ${t.fadeIn}`}>
      <div className={t.viewHead}>
        <div className={t.vhTitle}>
          <div className={t.eyebrowSm}>Decision inbox</div>
          <h1 className={t.hPage} style={{ marginTop: 6 }}>
            {waiting.length > 0 ? `${waiting.length} waiting` : "All caught up"}
          </h1>
        </div>
        <div className={t.vhSpacer} />
        {waiting.length > 0 ? (
          <div className={styles.chips} role="group" aria-label="Filter decisions">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`${styles.chip} ${filter === f.key ? styles.active : ""}`}
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {waiting.length > 0 ? (
        <p className={styles.intro}>
          The agent is still working on {project.agentTasks} tasks while these wait. A queue, not an
          interruption.
        </p>
      ) : null}

      {decisions.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.ei}>
            <Icon name="checkCircle" size={30} />
          </span>
          <h3>{waiting.length === 0 ? "Nothing waiting on you" : "No decisions in this filter"}</h3>
          <p>
            {waiting.length === 0
              ? "Every decision is resolved. The agent will surface the next one here the moment it needs you."
              : "Try a different filter to see the other parked decisions."}
          </p>
        </div>
      ) : (
        <ul className={styles.qlist} aria-label="Parked decisions">
          {decisions.map((d) => (
            <li key={d.id}>
              <button type="button" className={styles.qrow} onClick={() => openDecision(d.id)}>
                <span className={`${styles.qico} ${styles[d.risk]}`} aria-hidden="true">
                  <Icon name={d.risk === "high" ? "alert" : "diamond"} size={19} />
                </span>
                <span className={styles.qbody}>
                  <span className={styles.qtitle}>{d.title}</span>
                  <span className={styles.qbadges}>
                    <RiskBadge risk={d.risk} />
                    <RevBadge reversible={d.reversible} />
                    <Badge variant="neutral" mono>
                      {d.stream}
                    </Badge>
                  </span>
                  <span className={styles.qdesc}>
                    Agent recommends <strong>{d.recReason}</strong>. {recLine(d.context)}
                  </span>
                </span>
                <span className={styles.qside}>
                  <span className={styles.qtime}>parked {d.parked}</span>
                  {d.blocking ? (
                    <Badge variant="accent">Blocks 1 task</Badge>
                  ) : (
                    <Badge variant="neutral">Non-blocking</Badge>
                  )}
                  <span className={styles.review}>
                    Review <Icon name="chevronRight" size={15} />
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
