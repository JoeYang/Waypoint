import { useEffect, useRef, useState, type JSX } from "react";
import { useReentry } from "../wp/useReentry.js";
import { loadDirection, saveDirection, type ReentryDirection } from "../wp/reentryPref.js";
import { Icon, type IconName } from "../wp/icons.js";
import { Briefing } from "./Briefing.js";
import { MissionControl } from "./MissionControl.js";
import { TimelineDrawer } from "./TimelineDrawer.js";
import styles from "./ReentrySurface.module.css";

// The re-entry surface switcher + mount (S3d). Wires the three re-entry surfaces — Briefing,
// Mission Control, Timeline — behind one persisted, switchable preference (reentryPref), and mounts
// the chosen one in place of the old flat WhileYouWereAway banner. A returning human picks which
// surface greets them via a segmented radiogroup; the choice persists across visits and swaps the
// rendered surface live while it is open. The surface auto-opens once on mount when the re-entry
// data is ready and there is something to show (an open decision or a moved node); it is closeable
// and reopenable from a visible "While you were away" trigger. Loading / error never force a
// surface open — only the switcher + trigger render.

const SURFACES: ReadonlyArray<{ id: ReentryDirection; label: string; icon: IconName }> = [
  { id: "briefing", label: "Briefing", icon: "file" },
  { id: "mission", label: "Mission control", icon: "cpu" },
  { id: "timeline", label: "Timeline", icon: "clock" },
];

export function ReentrySurface({ projectId }: { projectId: string }): JSX.Element {
  const store = typeof localStorage !== "undefined" ? localStorage : undefined;
  const [direction, setDirection] = useState<ReentryDirection>(() => loadDirection(store));
  const [open, setOpen] = useState(false);
  // Auto-open fires at most once per mount, the first time the data becomes ready with content.
  const autoOpened = useRef(false);

  const state = useReentry(projectId);
  const hasContent =
    state.status === "ready" && (state.model.needsYou.length > 0 || state.model.moved.length > 0);

  useEffect(() => {
    if (!autoOpened.current && hasContent) {
      autoOpened.current = true;
      setOpen(true);
    }
  }, [hasContent]);

  const select = (id: ReentryDirection): void => {
    setDirection(id);
    saveDirection(store, id);
  };

  const close = (): void => setOpen(false);

  return (
    <div className={styles.root}>
      <div className={styles.bar}>
        <div className={styles.switcher} role="radiogroup" aria-label="Re-entry view">
          {SURFACES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={direction === s.id}
              aria-label={s.label}
              className={`${styles.option} ${direction === s.id ? styles.optionOn : ""}`}
              onClick={() => select(s.id)}
            >
              <Icon name={s.icon} size={15} />
              <span className={styles.optionLabel}>{s.label}</span>
            </button>
          ))}
        </div>

        {!open ? (
          <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
            <Icon name="arrowRight" size={14} />
            While you were away
          </button>
        ) : null}
      </div>

      {open ? <Surface direction={direction} projectId={projectId} onClose={close} /> : null}
    </div>
  );
}

// Renders the chosen direction component. Each surface owns its own loading / error / ready states
// via useReentry, so this is a pure dispatch with an exhaustive switch.
function Surface({
  direction,
  projectId,
  onClose,
}: {
  direction: ReentryDirection;
  projectId: string;
  onClose: () => void;
}): JSX.Element {
  switch (direction) {
    case "briefing":
      return <Briefing projectId={projectId} onClose={onClose} />;
    case "mission":
      return <MissionControl projectId={projectId} onClose={onClose} />;
    case "timeline":
      return <TimelineDrawer projectId={projectId} onClose={onClose} />;
    default:
      return assertNever(direction);
  }
}

function assertNever(direction: never): never {
  throw new Error(`unhandled re-entry direction: ${String(direction)}`);
}
