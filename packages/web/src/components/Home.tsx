import type { JSX } from "react";
import { useWaypoint } from "../wp/WaypointProvider.js";
import { Icon } from "../wp/icons.js";
import { AgentPill } from "./AgentPill.js";
import { Badge } from "./Badge.js";
import { currentTask, projectTally } from "../wp/helpers.js";
import type { Project } from "../wp/types.js";
import t from "./typography.module.css";
import styles from "./Home.module.css";

// Cross-project landing / re-entry: a needs-you command bar surfacing the actual parked decisions,
// a demoted metric strip, and per-project cards showing where each agent is now.
export function Home(): JSX.Element {
  const { data, navigate, openDecision, resolved } = useWaypoint();

  const openCount = (p: Project): number => p.decisions.filter((d) => !resolved[d.id]).length;

  // The actual parked decisions across all projects, each carrying its project.
  const parked = data.projects
    .flatMap((p) => p.decisions.map((d) => ({ d, project: p })))
    .filter(({ d }) => !resolved[d.id]);

  const decisionsWaiting = parked.length;
  const agentsWorking = data.projects.filter((p) => p.agent === "working").length;
  const tasksInFlight = data.projects.reduce(
    (a, p) =>
      a + p.streams.reduce((b, s) => b + s.tasks.filter((x) => x.status === "active").length, 0),
    0,
  );
  const streamsActive = data.projects.reduce(
    (a, p) => a + p.streams.filter((s) => s.status === "active").length,
    0,
  );

  const review = (project: Project, id: string): void => {
    navigate({ project: project.id });
    openDecision(id);
  };

  return (
    <div className={`${t.viewInner} ${t.fadeIn}`}>
      <section className={styles.bar} aria-label="Needs you">
        <div className={styles.barHead}>
          <span className={`${styles.count} ${decisionsWaiting === 0 ? styles.countCalm : ""}`}>
            {decisionsWaiting}
          </span>
          <div className={styles.barTitles}>
            <div className={styles.waiting}>waiting on you</div>
            <div className={styles.greeting}>Good morning, Joe — it&apos;s {data.now}.</div>
          </div>
        </div>

        {decisionsWaiting > 0 ? (
          <ul className={styles.decList}>
            {parked.map(({ d, project }) => (
              <li key={d.id} className={styles.decRow}>
                <div className={styles.decMain}>
                  <div className={styles.decTitle}>{d.title}</div>
                  <div className={styles.decMeta}>
                    <span className={styles.decProject}>{project.name}</span> · parked {d.parked}
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.review}
                  onClick={() => review(project, d.id)}
                >
                  Review
                  <span className={styles.reviewChev} aria-hidden="true">
                    <Icon name="arrowRight" size={14} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.allClear}>
            <Icon name="check" size={16} />
            You&apos;re all caught up — nothing is waiting on you.
          </div>
        )}
      </section>

      <p className={styles.metricStrip}>
        {data.projects.length} projects · {agentsWorking} agents working · {tasksInFlight} tasks in
        flight · {streamsActive} active streams
      </p>

      <div className={styles.head}>
        <div className={t.eyebrowSm}>Overview</div>
        <h1 className={t.hPage} style={{ marginTop: 6 }}>
          All projects
        </h1>
      </div>

      <div className={styles.projGrid}>
        {data.projects.map((p) => {
          const dc = openCount(p);
          const tally = projectTally(p);
          const now = currentTask(p);
          const pct = (n: number): string =>
            tally.total > 0 ? `${(n / tally.total) * 100}%` : "0%";
          return (
            <button
              key={p.id}
              type="button"
              className={styles.pcard}
              data-parked={dc > 0 ? "true" : undefined}
              onClick={() => navigate({ project: p.id, view: "map" })}
            >
              <div className={styles.pcardTop}>
                <span className={styles.glyph} style={{ background: p.color }}>
                  {p.glyph}
                </span>
                <div className={styles.pt}>
                  <div className={styles.nm}>{p.name}</div>
                  <div className={styles.dsc}>{p.desc}</div>
                </div>
                <AgentPill agent={p.agent} tasks={p.agentTasks} />
              </div>

              {now ? (
                <div className={styles.now}>
                  <span className={styles.nowDot} />
                  Now — <span className={styles.nowTask}>{now.name}</span>
                </div>
              ) : null}

              <div className={styles.meter}>
                <span
                  className={styles.meterTrack}
                  role="img"
                  aria-label={`Progress: ${tally.done} of ${tally.total} tasks done`}
                >
                  <i className={styles.segDone} style={{ width: pct(tally.done) }} />
                  <i className={styles.segActive} style={{ width: pct(tally.active) }} />
                  <i className={styles.segParked} style={{ width: pct(tally.parked) }} />
                </span>
                <span className={styles.meterLabel}>
                  {tally.done} / {tally.total}
                </span>
              </div>

              <div className={styles.pcardFoot}>
                {dc > 0 ? (
                  <Badge variant="warning">
                    <Icon name="diamond" size={12} />
                    {dc} decision{dc > 1 ? "s" : ""} waiting
                  </Badge>
                ) : (
                  <Badge variant="success">
                    <Icon name="check" size={12} />
                    All caught up
                  </Badge>
                )}
                <span className={styles.open}>
                  Open <Icon name="arrowRight" size={15} />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
