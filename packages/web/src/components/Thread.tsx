import { useEffect, useRef, useState, type JSX, type KeyboardEvent } from "react";
import { useWaypoint } from "../wp/WaypointProvider.js";
import { Icon } from "../wp/icons.js";
import type { Decision, Message, User } from "../wp/types.js";
import styles from "./Thread.module.css";

function Msg({ m, user }: { m: Message; user: User }): JSX.Element {
  const label = m.who === "agent" ? "Agent" : m.who === "you" ? user.name : "Waypoint";
  return (
    <div className={`${styles.msg} ${styles[m.who]}`}>
      {m.who === "system" ? (
        <span className={`${styles.av} ${styles.system}`} aria-hidden="true">
          <Icon name="info" size={18} />
        </span>
      ) : (
        <span
          className={`${styles.av} ${m.who === "agent" ? styles.agent : styles.you}`}
          aria-hidden="true"
        >
          {m.who === "agent" ? <Icon name="cpu" size={15} /> : user.initials}
        </span>
      )}
      <div className={styles.mc}>
        <div className={styles.mtop}>
          <span className={styles.who}>{label}</span>
          <span className={styles.mt}>{m.t}</span>
        </div>
        <div className={styles.mbody}>{m.text}</div>
      </div>
    </div>
  );
}

// The discussion alongside a proposal. The composer is kind-aware (live): a PROPOSAL takes an
// "Approve with adjustment" (the backend's adjust verdict — it resolves, per D3); a DECISION or
// QUESTION is read-only here (answered via the option cards). Mock decisions carry no kind, so
// they keep the prototype's free-form composer (you + an agent reply).
const COMPOSER = {
  comment: {
    placeholder: "Comment, or redirect the agent…",
    hint: "⌘↩ to send · threads to the agent",
    button: "Send",
    label: "Comment, or redirect the agent",
  },
  adjust: {
    placeholder: "Add an adjustment, then approve…",
    hint: "⌘↩ to approve with this note",
    button: "Approve with adjustment",
    label: "Approve with an adjustment note",
  },
} as const;

export function Thread({ decision }: { decision: Decision }): JSX.Element {
  const { data, threads, comment, adjust } = useWaypoint();
  const [text, setText] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  const messages = [...decision.thread, ...(threads[decision.id] ?? [])];

  // Known DECISION/QUESTION asks are answered via the options, not free text → no composer.
  const mode: "comment" | "adjust" | null =
    decision.kind === "proposal" ? "adjust" : decision.kind === undefined ? "comment" : null;

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = (): void => {
    const v = text.trim();
    if (!v || mode === null) return;
    if (mode === "adjust") adjust(decision.id, v);
    else comment(decision.id, v);
    setText("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className={styles.thread}>
      <div className={styles.threadH}>
        <Icon name="message" size={16} />
        Discussion with the agent
      </div>
      <div
        className={styles.threadBody}
        ref={bodyRef}
        role="log"
        aria-label="Discussion with the agent"
      >
        {messages.map((m, i) => (
          <Msg key={i} m={m} user={data.user} />
        ))}
      </div>
      {mode === null ? null : (
        <div className={styles.threadCompose}>
          <div className={styles.composeBox}>
            <textarea
              className={styles.textarea}
              aria-label={COMPOSER[mode].label}
              placeholder={COMPOSER[mode].placeholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <div className={styles.composeBar}>
              <span className={styles.hint}>{COMPOSER[mode].hint}</span>
              <div className={styles.sp} />
              <button
                type="button"
                className={`${styles.btn} ${styles.primary} ${styles.sm}`}
                onClick={send}
                disabled={text.trim() === ""}
              >
                <Icon name="send" size={14} />
                {COMPOSER[mode].button}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
