import { useState, type JSX } from "react";
import { useWaypoint } from "../wp/WaypointProvider.js";
import { useToast } from "./ToastProvider.js";
import { Icon } from "../wp/icons.js";
import { Badge } from "./Badge.js";
import { RiskBadge } from "./RiskBadge.js";
import type { Decision } from "../wp/types.js";
import styles from "./DecisionCard.module.css";

// A compact, inline decision act-card — the re-entry surfaces' unit of "needs you". It collapses
// the full Proposal into one card you can act on without leaving the briefing: approve the agent's
// recommendation in one click, or expand to pick another option and/or redirect with a constraint.
// Resolution is optimistic via the provider (same answer/reconcile path as the full Proposal); a
// resolved card is terminal here (the agent resumes), matching the Proposal's resolved banner.
export function DecisionCard({ decision }: { decision: Decision }): JSX.Element {
  const { resolved, resolve, adjust } = useWaypoint();
  const { toast } = useToast();
  // Resolve / adjust, confirming with a toast alongside the existing optimistic flip. The toast
  // never changes resolve/adjust semantics — it is enqueued on the same user action.
  const applyOption = (name: string): void => {
    resolve(decision.id, name);
    toast(`Applied ${name} — agent resuming`);
  };
  const sendAdjustment = (note: string): void => {
    adjust(decision.id, note);
    toast("Sent your adjustment — agent resuming");
  };
  const recIdx = decision.options.findIndex((o) => o.rec);
  const recName = decision.options[recIdx >= 0 ? recIdx : 0]?.name ?? "";
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(recIdx >= 0 ? recIdx : 0);
  const [redirect, setRedirect] = useState("");

  const entry = resolved[decision.id];
  if (entry !== undefined) {
    return (
      <section className={`${styles.card} ${styles.resolved}`} aria-label={decision.title}>
        <div className={styles.resolvedRow}>
          <Icon name="checkCircle" size={18} />
          <span>
            Approved <strong className={styles.choice}>{entry.option}</strong> — agent is applying
            it and resuming “{decision.blocksTask}”.
          </span>
        </div>
      </section>
    );
  }

  const selName = decision.options[sel]?.name ?? recName;
  const hasConstraint = redirect.trim().length > 0;
  const apply = (): void => {
    if (hasConstraint) sendAdjustment(redirect.trim());
    else applyOption(selName);
  };

  return (
    <section
      className={`${styles.card} ${decision.risk === "high" ? styles.high : ""}`}
      aria-label={decision.title}
    >
      <div className={styles.head}>
        <span className={`${styles.ico} ${decision.risk === "high" ? styles.icoHigh : ""}`}>
          <Icon name="diamond" size={17} />
        </span>
        <div className={styles.body}>
          <h2 className={styles.q}>{decision.title}</h2>
          <div className={styles.meta}>
            {decision.isNew ? (
              <Badge variant="accent">NEW</Badge>
            ) : (
              <Badge variant="neutral">Seen</Badge>
            )}
            <RiskBadge risk={decision.risk} />
            <Badge variant="accent" mono>
              {decision.stream}
            </Badge>
            {decision.blocking ? (
              <Badge variant="warning">Blocks 1 task</Badge>
            ) : (
              <Badge variant="neutral">Non-blocking</Badge>
            )}
            <span className={styles.parked}>parked {decision.parked}</span>
          </div>
          <p className={styles.ctx}>{decision.context}</p>
        </div>
      </div>

      {open ? (
        <div className={styles.review}>
          <div className={styles.chips} role="radiogroup" aria-label="Options and tradeoffs">
            {decision.options.map((o, i) => (
              <button
                key={o.name}
                type="button"
                role="radio"
                aria-checked={i === sel}
                className={`${styles.chip} ${i === sel ? styles.sel : ""}`}
                onClick={() => setSel(i)}
              >
                <span className={styles.radio} aria-hidden="true" />
                <span className={styles.chipText}>
                  <span className={styles.on}>{o.name}</span>
                  <span className={styles.tr}>
                    {o.pros[0]}
                    {o.cons[0] ? ` · ${o.cons[0]}` : ""}
                  </span>
                </span>
                {o.rec ? <span className={styles.recpill}>Recommended</span> : null}
              </button>
            ))}
          </div>
          <textarea
            className={styles.redirect}
            aria-label="Redirect the agent"
            placeholder="Or redirect the agent — add a constraint or ask a question…"
            value={redirect}
            onChange={(e) => setRedirect(e.target.value)}
          />
          <div className={styles.actions}>
            <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={apply}>
              <Icon name="check" size={15} />
              {hasConstraint ? "Send & apply " : "Apply "}
              {selName}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.ghost}`}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.primary}`}
            onClick={() => applyOption(recName)}
          >
            <Icon name="check" size={15} />
            Approve {recName}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.secondary}`}
            onClick={() => setOpen(true)}
          >
            <Icon name="message" size={15} />
            Review &amp; redirect
          </button>
          <span className={styles.recnote}>
            <Icon name="star" size={13} />
            Agent recommends {recName}
          </span>
        </div>
      )}
    </section>
  );
}
