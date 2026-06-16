import { useState, type JSX } from "react";
import { useWaypoint } from "../wp/WaypointProvider.js";
import { Icon } from "../wp/icons.js";
import { Badge } from "./Badge.js";
import { RiskBadge } from "./RiskBadge.js";
import { RevBadge } from "./RevBadge.js";
import type { Decision, Project } from "../wp/types.js";
import t from "./typography.module.css";
import styles from "./Proposal.module.css";

// The decision detail: the question, why it came up, the option cards with tradeoffs, the
// defer callout, and the resolve action. The discussion thread lands alongside in PR6b.
export function Proposal(): JSX.Element {
  const { data, nav } = useWaypoint();
  const project = data.projects.find((p) => p.id === nav.project);
  const decision = project?.decisions.find((d) => d.id === nav.decision);

  if (!project || !decision) {
    return (
      <div className={t.viewInner}>
        <p className={styles.empty}>
          That decision is no longer available — it may have been resolved.
        </p>
      </div>
    );
  }

  return <ProposalView project={project} decision={decision} />;
}

function ProposalView({
  project,
  decision,
}: {
  project: Project;
  decision: Decision;
}): JSX.Element {
  const { resolved, resolve, navigate } = useWaypoint();
  const recIdx = decision.options.findIndex((o) => o.rec);
  const [selected, setSelected] = useState(recIdx >= 0 ? recIdx : 0);

  const entry = resolved[decision.id];
  const isResolved = entry !== undefined;
  const chosenName = isResolved ? entry.option : (decision.options[selected]?.name ?? "");
  const isRec = !isResolved && selected === recIdx;

  return (
    <div className={`${t.viewInner} ${t.viewInnerWide} ${t.fadeIn}`}>
      <button
        type="button"
        className={styles.backLink}
        onClick={() => navigate({ project: project.id, view: "inbox", decision: null })}
      >
        <Icon name="arrowLeft" size={15} />
        Back to decisions
      </button>

      <div className={styles.prop}>
        <div className={styles.propH}>
          <div className={styles.propBadges}>
            <RiskBadge risk={decision.risk} />
            <RevBadge reversible={decision.reversible} />
            <Badge variant="accent">
              <Icon name="diamond" size={12} />
              {decision.stream}
            </Badge>
          </div>
          <h2 className={styles.propQ}>{decision.title}</h2>
          <div className={styles.propMeta}>
            Parked {decision.parked}
            <span className={styles.dotsep}>·</span>
            agent continued on {decision.continuedDescription}
            <span className={styles.dotsep}>·</span>
            <span className={styles.codeRef}>{decision.file}</span>
          </div>
        </div>

        <div className={styles.propB}>
          <div>
            <div className={styles.secL}>Why this came up</div>
            <div className={styles.secT}>{decision.context}</div>
          </div>

          <div>
            <div className={styles.secL}>
              Options &amp; tradeoffs — {isResolved ? "you chose " : "pick one"}
              {isResolved ? <strong>{chosenName}</strong> : null}
            </div>
            <div className={styles.opts} role="radiogroup" aria-label="Options and tradeoffs">
              {decision.options.map((o, i) => {
                const active = isResolved ? o.name === chosenName : i === selected;
                return (
                  <button
                    key={o.name}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={isResolved}
                    className={`${styles.opt} ${active ? styles.sel : ""}`}
                    onClick={isResolved ? undefined : () => setSelected(i)}
                  >
                    {o.rec ? (
                      <span className={styles.rectag}>
                        <Icon name="star" size={11} />
                        Agent recommends
                      </span>
                    ) : null}
                    <span className={styles.on}>
                      {o.name}
                      <span className={styles.radio} aria-hidden="true" />
                    </span>
                    {o.pros.map((p, k) => (
                      <span key={`p${k}`} className={`${styles.tr} ${styles.pro}`}>
                        <span className={styles.pm}>+</span>
                        {p}
                      </span>
                    ))}
                    {o.cons.map((c, k) => (
                      <span key={`c${k}`} className={`${styles.tr} ${styles.con}`}>
                        <span className={styles.pm}>−</span>
                        {c}
                      </span>
                    ))}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`${styles.callout} ${styles[decision.impact.kind]}`}>
            <Icon name={decision.impact.kind === "danger" ? "alert" : "info"} size={17} />
            <div className={styles.ct}>
              <strong>If you defer:</strong> {decision.impact.text}
            </div>
          </div>
        </div>

        {isResolved ? (
          <div className={styles.resolvedBanner}>
            <Icon name="checkCircle" size={18} />
            Resolved — agent is applying{" "}
            <strong className={styles.bannerChoice}>{chosenName}</strong> and resuming “
            {decision.blocksTask}”.
          </div>
        ) : (
          <div className={styles.propActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.primary}`}
              onClick={() => resolve(decision.id, chosenName)}
            >
              <Icon name="check" size={16} />
              {isRec ? "Approve recommendation" : `Apply ${chosenName}`}
            </button>
            <span className={styles.hint}>
              {isRec
                ? `${decision.recReason} is the agent's pick`
                : "Overriding the recommendation"}
            </span>
            <span className={styles.sp} />
            {decision.reversible ? (
              <span className={styles.revHint}>
                <Icon name="rotate" size={14} />
                Reversible — safe to decide fast
              </span>
            ) : (
              <Badge variant="danger">
                <Icon name="lock" size={12} />
                Needs typed confirmation
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
