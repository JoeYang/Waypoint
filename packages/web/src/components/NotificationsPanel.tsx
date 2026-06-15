import type { JSX } from "react";
import { useWaypoint } from "../wp/WaypointProvider.js";
import { Icon, type IconName } from "../wp/icons.js";
import type { NotificationTarget, NotificationTone } from "../wp/types.js";
import type { View } from "../wp/state.js";
import styles from "./NotificationsPanel.module.css";

const cx = (...classes: (string | false | undefined)[]): string =>
  classes.filter(Boolean).join(" ");

const TONE: Record<NotificationTone, { bg: string; fg: string }> = {
  warning: { bg: "#fbf2dd", fg: "var(--amber-500)" },
  success: { bg: "#edf4ee", fg: "var(--green-600)" },
  accent: { bg: "var(--accent-50)", fg: "var(--accent-600)" },
};

export interface NotificationsPanelProps {
  onClose: () => void;
}

export function NotificationsPanel({ onClose }: NotificationsPanelProps): JSX.Element {
  const { data, navigate } = useWaypoint();

  // A decision notification opens its proposal (the prototype routed it to the map — a quirk);
  // otherwise honour the explicit target view.
  const open = (to: NotificationTarget): void => {
    if (to.decision) {
      navigate({ project: to.project, view: "proposal", decision: to.decision });
    } else {
      navigate({ project: to.project, view: (to.view as View | undefined) ?? "map" });
    }
    onClose();
  };

  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden={true} />
      <div className={styles.panel} role="dialog" aria-label="Notifications">
        <div className={styles.head}>
          <span className={styles.title}>Notifications</span>
          <button type="button" className={styles.markRead} onClick={onClose}>
            Mark all read
          </button>
        </div>
        <ul className={styles.list}>
          {data.notifications.map((n) => {
            const tone = TONE[n.tone];
            return (
              <li key={n.id}>
                <button
                  type="button"
                  className={cx(styles.notif, n.unread && styles.unread)}
                  onClick={() => open(n.to)}
                >
                  <span className={styles.ni} style={{ background: tone.bg, color: tone.fg }}>
                    <Icon name={n.icon as IconName} size={16} />
                  </span>
                  <span className={styles.body}>
                    <span className={styles.ntx}>{n.text}</span>
                    <span className={styles.ntm}>
                      {n.project} · {n.time}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
