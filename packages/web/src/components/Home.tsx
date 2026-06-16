import { useState, type JSX } from "react";
import { useWaypoint } from "../wp/WaypointProvider.js";
import { Icon } from "../wp/icons.js";
import { AgentPill } from "./AgentPill.js";
import { Badge } from "./Badge.js";
import { streamProgress, streamBarColor } from "../wp/helpers.js";
import type { Project } from "../wp/types.js";
import t from "./typography.module.css";
import styles from "./Home.module.css";

// Cross-project landing: the returning-human briefing, summary stats, and per-project cards.
export function Home(): JSX.Element {
  const { data, navigate, resolved } = useWaypoint();
  const [briefingOpen, setBriefingOpen] = useState(true);

  const open = (p: Project): number => p.decisions.filter((d) => !resolved[d.id]).length;
  const decisionsWaiting = data.projects.reduce((a, p) => a + open(p), 0);
  const agentsWorking = data.projects.filter((p) => p.agent === "working").length;
  const tasksInFlight = data.projects.reduce((a, p) => a + p.agentTasks, 0);
  const streamsActive = data.projects.reduce(
    (a, p) => a + p.streams.filter((s) => s.status === "active").length,
    0,
  );

  return (
    <div className={`${t.viewInner} ${t.fadeIn}`}>
      {briefingOpen ? (
        <section className={styles.briefing} aria-label="Morning briefing">
          <span className={styles.bi}>
            <Icon name="sun" size={22} />
          </span>
          <div>
            <div className={styles.briefingTitle}>Good morning, Joe — it's {data.now}.</div>
            <div className={styles.briefingText}>
              While you were away, your three agents kept building. They finished what they could
              and parked {decisionsWaiting} decisions for you. Nothing is fully blocked — pick these
              up whenever you're ready.
            </div>
          </div>
          <button
            type="button"
            className={styles.x}
            aria-label="Dismiss briefing"
            onClick={() => setBriefingOpen(false)}
          >
            <Icon name="x" size={17} />
          </button>
        </section>
      ) : null}

      <div className={styles.head}>
        <div className={t.eyebrowSm}>Overview</div>
        <h1 className={t.hPage} style={{ marginTop: 6 }}>
          All projects
        </h1>
      </div>

      <div className={styles.statRow}>
        <div className={styles.stat}>
          <div className={`${styles.v} ${styles.vWarn}`}>{decisionsWaiting}</div>
          <div className={styles.l}>Decisions waiting on you</div>
        </div>
        <div className={styles.stat}>
          <div className={`${styles.v} ${styles.vAccent}`}>{agentsWorking}</div>
          <div className={styles.l}>Agents working now</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.v}>{tasksInFlight}</div>
          <div className={styles.l}>Tasks in flight</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.v}>{streamsActive}</div>
          <div className={styles.l}>Active work streams</div>
        </div>
      </div>

      <div className={styles.projGrid}>
        {data.projects.map((p) => {
          const dc = open(p);
          return (
            <button
              key={p.id}
              type="button"
              className={styles.pcard}
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
              <div className={styles.pcardStreams}>
                {p.streams.slice(0, 4).map((s) => {
                  const pr = streamProgress(s);
                  return (
                    <div key={s.id} className={styles.streamline}>
                      <span className={styles.snm}>{s.name}</span>
                      <span className={styles.bar}>
                        <i
                          className={styles.barFill}
                          style={{ width: `${pr.pct}%`, background: streamBarColor(s) }}
                        />
                      </span>
                      <span className={styles.pct}>
                        {pr.done}/{pr.total}
                      </span>
                    </div>
                  );
                })}
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
