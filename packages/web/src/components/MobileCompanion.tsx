import { useEffect, useState, type JSX } from "react";
import { useWaypoint } from "../wp/WaypointProvider.js";
import { Icon } from "../wp/icons.js";
import { Badge } from "./Badge.js";
import { RiskBadge } from "./RiskBadge.js";
import { RevBadge } from "./RevBadge.js";
import t from "./typography.module.css";
import styles from "./MobileCompanion.module.css";

// The phone-bezel overlay: every parked decision across all projects, on one screen. Reversible
// decisions can be approved with a thumb (marked done locally — the companion is a preview, it
// doesn't mutate desktop state); one-way decisions defer to a desktop review. Opening a card
// jumps to its proposal on the desktop view behind the overlay.
export function MobileCompanion({ onClose }: { onClose: () => void }): JSX.Element {
  const { data, navigate } = useWaypoint();
  const [done, setDone] = useState<Record<string, boolean>>({});

  const all = data.projects.flatMap((p) =>
    p.decisions.map((d) => ({ d, projectId: p.id, projectName: p.name, color: p.color })),
  );
  const remaining = all.filter((x) => !done[x.d.id]).length;

  // Escape closes the overlay (dialog convention).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const open = (projectId: string, decisionId: string): void => {
    navigate({ project: projectId, view: "proposal", decision: decisionId });
    onClose();
  };

  return (
    <div
      className={styles.scrim}
      role="dialog"
      aria-modal="true"
      aria-label="Mobile companion"
      onClick={onClose}
    >
      <div className={styles.copy} onClick={(e) => e.stopPropagation()}>
        <div className={t.eyebrowSm}>Mobile companion</div>
        <h3 className={styles.copyTitle}>Approve from anywhere.</h3>
        <p>
          The same parked decisions, on your phone. Glance at the recommendation between meetings,
          approve with a thumb, and the agent picks it up — you never have to be at your desk to
          keep the work moving.
        </p>
        <button type="button" className={styles.close} onClick={onClose}>
          <Icon name="x" size={16} />
          Close companion
        </button>
      </div>

      <div className={styles.phone} onClick={(e) => e.stopPropagation()}>
        <div className={styles.screen}>
          <div className={styles.notch} aria-hidden="true" />
          <div className={styles.status}>
            <span>9:41</span>
            <span>Waypoint</span>
          </div>
          <div className={styles.top}>
            <Icon name="inbox" size={20} />
            <span className={styles.pht}>Decisions</span>
            <Badge variant="warning">{remaining} waiting</Badge>
          </div>
          <div className={styles.body}>
            {remaining === 0 ? (
              <div className={styles.empty}>
                <span className={styles.ei}>
                  <Icon name="checkCircle" size={28} />
                </span>
                <h3>All clear</h3>
                <p>Every decision is resolved. Go enjoy your coffee.</p>
              </div>
            ) : null}
            {all.map(({ d, projectId, projectName, color }) =>
              done[d.id] ? (
                <article
                  key={d.id}
                  className={`${styles.card} ${styles.cardDone}`}
                  aria-label={d.title}
                >
                  <div className={styles.approvedRow}>
                    <Icon name="checkCircle" size={16} />
                    Approved · {d.recReason}
                  </div>
                  <div className={styles.doneTitle}>{d.title}</div>
                </article>
              ) : (
                <article key={d.id} className={styles.card} aria-label={d.title}>
                  <div className={styles.cardProject}>
                    <span className={styles.glyph} style={{ background: color }}>
                      {projectName.slice(0, 2).toUpperCase()}
                    </span>
                    <span className={styles.projectName}>{projectName}</span>
                  </div>
                  <div className={styles.pct}>{d.title}</div>
                  <div className={styles.pcb}>
                    <RiskBadge risk={d.risk} />
                    <RevBadge reversible={d.reversible} />
                  </div>
                  <div className={styles.pcd}>
                    Agent recommends <strong>{d.recReason}</strong>.
                  </div>
                  <div className={styles.pca}>
                    {d.reversible ? (
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.primary}`}
                        onClick={() => setDone((s) => ({ ...s, [d.id]: true }))}
                      >
                        <Icon name="check" size={14} />
                        Approve
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.danger}`}
                        onClick={() => open(projectId, d.id)}
                      >
                        <Icon name="lock" size={13} />
                        Review on desktop
                      </button>
                    )}
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.secondary}`}
                      onClick={() => open(projectId, d.id)}
                    >
                      Open
                    </button>
                  </div>
                </article>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
