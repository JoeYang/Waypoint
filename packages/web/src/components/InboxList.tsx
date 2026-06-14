import type { AnswerRequest, InboxItem } from "@waypoint/shared";
import { InboxCard } from "./InboxCard.js";
import styles from "./InboxList.module.css";

interface InboxListProps {
  items: InboxItem[]; // already ranked by the caller (most-blocking first)
  workingAskIds: ReadonlySet<string>;
  onAnswer: (askId: string, req: AnswerRequest) => void;
}

// The ranked queue of cards, or an empty state when nothing is waiting. Purely
// presentational — ranking and the working set are owned by the container.
export function InboxList({ items, workingAskIds, onAnswer }: InboxListProps): React.JSX.Element {
  if (items.length === 0) {
    return (
      <div className={styles.empty} role="status">
        <p className="lead">Nothing waiting on you.</p>
        <p className="muted">Parked decisions appear here, most-blocking first.</p>
      </div>
    );
  }

  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.askId} className={styles.row}>
          <InboxCard
            item={item}
            working={workingAskIds.has(item.askId)}
            onAnswer={(req) => onAnswer(item.askId, req)}
          />
        </li>
      ))}
    </ul>
  );
}
