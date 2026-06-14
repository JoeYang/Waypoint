import { useState } from "react";
import type { AnswerRequest, InboxItem } from "@waypoint/shared";
import styles from "./InboxCard.module.css";

interface InboxCardProps {
  item: InboxItem;
  working: boolean;
  onAnswer: (req: AnswerRequest) => void;
}

// One inbox card: the parked ask, the context a human needs to answer in one glance
// (rationale, the goal it ladders toward, the named work it blocks, who parked it), and an
// answer control matched to the ask type. While an answer is in flight the card shows a
// working state (announced to assistive tech) instead of the control — the card is removed
// for real when the WebSocket delta drops it, so this never optimistically lies.
export function InboxCard({ item, working, onAnswer }: InboxCardProps): React.JSX.Element {
  const promptId = `ask-${item.askId}-prompt`;
  const blocks = item.blastRadius;
  return (
    <article className={styles.card} aria-busy={working} aria-labelledby={promptId}>
      <div className={styles.meta}>
        <span className={styles.node}>{item.nodeTitle}</span>
        <span
          className={styles.badge}
          aria-label={`blocks ${blocks} ${blocks === 1 ? "node" : "nodes"}`}
        >
          blocks {blocks}
        </span>
      </div>
      <h3 id={promptId} className={styles.prompt}>
        {item.prompt}
      </h3>
      <DecisionContext item={item} />
      {working ? (
        <p className={styles.working} role="status" aria-live="polite">
          Working…
        </p>
      ) : (
        <AnswerControl item={item} promptId={promptId} onAnswer={onAnswer} />
      )}
    </article>
  );
}

// The glanceable context. Every field is optional so older asks (and absent context)
// degrade gracefully — nothing is invented when a field is missing.
function DecisionContext({ item }: { item: InboxItem }): React.JSX.Element | null {
  const blocks = item.blocks ?? [];
  if (!item.rationale && !item.goalTitle && blocks.length === 0 && !item.parkedBy) return null;
  return (
    <div className={styles.context}>
      {item.rationale ? <p className={styles.rationale}>{item.rationale}</p> : null}
      {item.goalTitle ? (
        <p className={styles.goal}>
          Goal: <span className={styles.goalTitle}>{item.goalTitle}</span>
        </p>
      ) : null}
      {blocks.length > 0 ? (
        <div className={styles.blocks}>
          <span className={styles.blocksLabel}>Blocks</span>
          <ul className={styles.blocksList}>
            {blocks.map((b) => (
              <li key={b.nodeId}>{b.title}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {item.parkedBy ? (
        <p className={styles.provenance}>Parked by {item.parkedBy.agentLabel}</p>
      ) : null}
    </div>
  );
}

interface AnswerControlProps {
  item: InboxItem;
  promptId: string;
  onAnswer: (req: AnswerRequest) => void;
}

function AnswerControl({ item, promptId, onAnswer }: AnswerControlProps): React.JSX.Element {
  switch (item.type) {
    case "DECISION":
      return <DecisionOptions item={item} promptId={promptId} onAnswer={onAnswer} />;
    case "PROPOSAL":
      return <ProposalActions item={item} onAnswer={onAnswer} />;
    case "QUESTION":
      return <QuestionAnswer item={item} promptId={promptId} onAnswer={onAnswer} />;
    default: {
      const unreachable: never = item.type;
      throw new Error(`unhandled ask type: ${String(unreachable)}`);
    }
  }
}

// DECISION — one button per option; the consequence rides as a caption beside it so the
// button's accessible name stays the bare label.
function DecisionOptions({ item, promptId, onAnswer }: AnswerControlProps): React.JSX.Element {
  return (
    <div className={styles.options} role="group" aria-labelledby={promptId}>
      {item.options.map((option) => (
        <div key={option.id} className={styles.optionRow}>
          <button
            type="button"
            className={styles.option}
            onClick={() =>
              onAnswer({ expectedVersion: item.askVersion, chosenOptionId: option.id })
            }
          >
            {option.label}
          </button>
          {option.consequence ? (
            <span className={styles.consequence}>{option.consequence}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// PROPOSAL — Approve / Adjust / Reject. Adjust (alone) reveals one constraint field; an
// adjust is an approval that carries its constraint, never a fresh round-trip.
function ProposalActions({
  item,
  onAnswer,
}: {
  item: InboxItem;
  onAnswer: (req: AnswerRequest) => void;
}): React.JSX.Element {
  const [adjusting, setAdjusting] = useState(false);
  const [note, setNote] = useState("");
  const submitAdjust = (event: React.FormEvent): void => {
    event.preventDefault();
    const trimmed = note.trim();
    if (!trimmed) return;
    onAnswer({
      expectedVersion: item.askVersion,
      proposalVerdict: "adjust",
      adjustmentNote: trimmed,
    });
  };
  return (
    <div className={styles.proposal}>
      <div className={styles.verdicts} role="group">
        <button
          type="button"
          className={styles.approve}
          onClick={() => onAnswer({ expectedVersion: item.askVersion, proposalVerdict: "approve" })}
        >
          Approve
        </button>
        <button type="button" className={styles.option} onClick={() => setAdjusting(true)}>
          Adjust
        </button>
        <button
          type="button"
          className={styles.reject}
          onClick={() => onAnswer({ expectedVersion: item.askVersion, proposalVerdict: "reject" })}
        >
          Reject
        </button>
      </div>
      {adjusting ? (
        <form className={styles.textForm} onSubmit={submitAdjust}>
          <textarea
            className={styles.textInput}
            aria-label="Approval constraint"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder="Approve, but only if… (the constraint to proceed under)"
          />
          <button type="submit" className={styles.submit}>
            Save constraint
          </button>
        </form>
      ) : null}
    </div>
  );
}

// QUESTION — suggested answers first (one click), with free text as the fallback.
function QuestionAnswer({ item, promptId, onAnswer }: AnswerControlProps): React.JSX.Element {
  const [text, setText] = useState("");
  const suggestions = item.suggestedAnswers ?? [];
  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onAnswer({ expectedVersion: item.askVersion, answerText: trimmed });
  };
  return (
    <div className={styles.question}>
      {suggestions.length > 0 ? (
        <div className={styles.options} role="group" aria-labelledby={promptId}>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className={styles.option}
              onClick={() => onAnswer({ expectedVersion: item.askVersion, answerText: suggestion })}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
      <form className={styles.textForm} onSubmit={submit}>
        <textarea
          className={styles.textInput}
          aria-labelledby={promptId}
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={2}
          placeholder="Type your answer…"
        />
        <button type="submit" className={styles.submit}>
          Answer
        </button>
      </form>
    </div>
  );
}
