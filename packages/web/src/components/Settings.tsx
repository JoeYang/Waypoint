import { useState, type JSX } from "react";
import { useWaypoint } from "../wp/WaypointProvider.js";
import t from "./typography.module.css";
import styles from "./Settings.module.css";

interface ToggleRow {
  key: string;
  name: string;
  sub: string;
  on: boolean;
}
interface SettingsCard {
  title: string;
  desc: string;
  rows: ToggleRow[];
}

// Mirrors the handoff's local toggle state. These are UI-only this phase (no provider/persist);
// at wiring they become the agent's decision policy.
const CARDS: SettingsCard[] = [
  {
    title: "Decision policy",
    desc: "Decide what the agent can settle on its own versus what it parks for you.",
    rows: [
      {
        key: "autoLow",
        name: "Auto-approve low-risk, reversible decisions",
        sub: "The agent proceeds and logs it to Activity — no parking.",
        on: true,
      },
      {
        key: "autoFmt",
        name: "Don't ask about formatting or lint fixes",
        sub: "Cosmetic, always-reversible changes are applied silently.",
        on: true,
      },
      {
        key: "dryRun",
        name: "Require a dry-run for destructive migrations",
        sub: "High-risk, one-way changes always need typed confirmation.",
        on: true,
      },
    ],
  },
  {
    title: "Notifications",
    desc: "How Waypoint reaches you when a decision is parked.",
    rows: [
      {
        key: "notifPush",
        name: "Push to mobile companion",
        sub: "Get a tap-to-review notification on your phone.",
        on: true,
      },
      {
        key: "notifEmail",
        name: "Email digest",
        sub: "A summary of parked decisions every few hours.",
        on: false,
      },
    ],
  },
  {
    title: "Streams",
    desc: "How aggressively the agent parallelizes work.",
    rows: [
      {
        key: "parallel",
        name: "Run independent streams in parallel",
        sub: "Keeps other streams moving while one waits on a decision.",
        on: true,
      },
    ],
  },
];

const INITIAL: Record<string, boolean> = Object.fromEntries(
  CARDS.flatMap((c) => c.rows).map((r) => [r.key, r.on]),
);

// Per-agent working agreement: three cards of keyboard-operable toggles with local state.
export function Settings(): JSX.Element {
  const { data, nav } = useWaypoint();
  const [toggles, setToggles] = useState<Record<string, boolean>>(INITIAL);
  const project = data.projects.find((p) => p.id === nav.project);

  if (!project) {
    return (
      <div className={t.viewInner}>
        <p className={styles.empty}>
          No project selected — pick one from the sidebar to see its settings.
        </p>
      </div>
    );
  }

  const flip = (k: string): void => setToggles((prev) => ({ ...prev, [k]: !prev[k] }));

  return (
    <div className={`${t.viewInner} ${t.fadeIn}`}>
      <div className={styles.head}>
        <div className={t.eyebrowSm}>{project.name} · settings</div>
        <h1 className={t.hPage} style={{ marginTop: 6 }}>
          How this agent works with you
        </h1>
      </div>

      <div className={styles.grid}>
        {CARDS.map((card) => (
          <div key={card.title} className={styles.card}>
            <div className={styles.sch}>
              <h4>{card.title}</h4>
              <p>{card.desc}</p>
            </div>
            {card.rows.map((row) => {
              const on = toggles[row.key] ?? row.on;
              return (
                <div key={row.key} className={styles.row}>
                  <div className={styles.srd}>
                    <div className={styles.srn}>{row.name}</div>
                    <div className={styles.srs}>{row.sub}</div>
                  </div>
                  <button
                    type="button"
                    className={`${styles.toggle} ${on ? styles.on : ""}`}
                    aria-pressed={on}
                    aria-label={row.name}
                    onClick={() => flip(row.key)}
                  >
                    <span className={styles.knob} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
