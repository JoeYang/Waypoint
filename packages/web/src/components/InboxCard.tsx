import { useState } from "react";
import type { AnswerRequest, InboxItem } from "@waypoint/shared";
import styles from "./InboxCard.module.css";

interface InboxCardProps {
  item: InboxItem;
  working: boolean;
  onAnswer: (req: AnswerRequest) => void;
}

// One inbox card: the parked ask, the node it gates, a "blocks N" badge, and the answer
// control matched to the ask type. While an answer is in flight the card shows a working
// state (announced to assistive tech) instead of the control — the card is removed for real
// when the WebSocket delta drops it, so this never optimistically lies about the outcome.
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

interface AnswerControlProps {
  item: InboxItem;
  promptId: string;
  onAnswer: (req: AnswerRequest) => void;
}

function AnswerControl({ item, promptId, onAnswer }: AnswerControlProps): React.JSX.Element {
  switch (item.type) {
    case "DECISION":
      return (
        <div className={styles.options} role="group" aria-labelledby={promptId}>
          {item.options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={styles.option}
              onClick={() =>
                onAnswer({ expectedVersion: item.askVersion, chosenOptionId: option.id })
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      );
    case "QUESTION":
    case "PROPOSAL":
      return <TextAnswer item={item} promptId={promptId} onAnswer={onAnswer} />;
    default: {
      const unreachable: never = item.type;
      throw new Error(`unhandled ask type: ${String(unreachable)}`);
    }
  }
}

function TextAnswer({ item, promptId, onAnswer }: AnswerControlProps): React.JSX.Element {
  const [text, setText] = useState("");
  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onAnswer({ expectedVersion: item.askVersion, answerText: trimmed });
  };
  return (
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
  );
}
