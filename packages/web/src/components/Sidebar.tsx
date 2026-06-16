import type { JSX } from "react";
import { useWaypoint } from "../wp/WaypointProvider.js";
import { Icon, type IconName, WaypointMark } from "../wp/icons.js";
import type { Project } from "../wp/types.js";
import type { View } from "../wp/state.js";
import styles from "./Sidebar.module.css";

const cx = (...classes: (string | false | undefined)[]): string =>
  classes.filter(Boolean).join(" ");

const NAV_ITEMS: ReadonlyArray<{ id: View; label: string; icon: IconName }> = [
  { id: "map", label: "Project map", icon: "map" },
  { id: "inbox", label: "Decisions", icon: "inbox" },
  { id: "activity", label: "Activity", icon: "activity" },
  { id: "settings", label: "Settings", icon: "settings" },
];

export interface SidebarProps {
  onOpenMobile: () => void;
}

export function Sidebar({ onOpenMobile }: SidebarProps): JSX.Element {
  const { data, nav, navigate, goHome, resolved } = useWaypoint();
  const openCount = (p: Project): number => p.decisions.filter((d) => !resolved[d.id]).length;
  const activeProject = data.projects.find((p) => p.id === nav.project) ?? null;

  return (
    <aside className={styles.sidebar}>
      <button
        type="button"
        className={styles.brand}
        onClick={goHome}
        aria-label="Waypoint — all projects"
      >
        <WaypointMark size={26} />
        <span className={styles.brandName}>Waypoint</span>
      </button>

      <div className={styles.section}>
        <div className={styles.label}>
          Projects
          <button type="button" className={styles.add} aria-label="Add project">
            <Icon name="plus" size={15} />
          </button>
        </div>
        {data.projects.map((p) => {
          const dc = openCount(p);
          const idle = p.agent === "idle";
          const isActive = p.id === nav.project;
          return (
            <button
              key={p.id}
              type="button"
              className={cx(styles.proj, isActive && styles.active)}
              aria-current={isActive ? "true" : undefined}
              onClick={() => navigate({ project: p.id, view: "map" })}
            >
              <span className={styles.glyph} style={{ background: p.color }}>
                {p.glyph}
              </span>
              <span className={styles.meta}>
                <span className={styles.pname}>{p.name}</span>
                <span className={styles.pstat}>
                  <span className={cx(styles.liveDot, idle && styles.idleDot)} />
                  {idle ? "Idle · caught up" : `Working · ${p.agentTasks} tasks`}
                </span>
              </span>
              {dc > 0 ? <span className={styles.countPip}>{dc}</span> : null}
            </button>
          );
        })}
      </div>

      {activeProject ? (
        <nav
          className={cx(styles.section, styles.nav)}
          aria-label={`${activeProject.name} navigation`}
        >
          <div className={styles.label}>{activeProject.name}</div>
          {NAV_ITEMS.map((n) => {
            const isActive = nav.view === n.id;
            const pip = n.id === "inbox" ? openCount(activeProject) : 0;
            return (
              <button
                key={n.id}
                type="button"
                className={cx(styles.item, isActive && styles.itemActive)}
                aria-current={isActive ? "page" : undefined}
                onClick={() => navigate({ project: activeProject.id, view: n.id })}
              >
                <Icon name={n.icon} size={18} />
                {n.label}
                {pip > 0 ? <span className={cx(styles.pip, styles.pipWarn)}>{pip}</span> : null}
              </button>
            );
          })}
          <button type="button" className={styles.item} onClick={onOpenMobile}>
            <Icon name="smartphone" size={18} />
            Mobile companion
          </button>
        </nav>
      ) : null}

      <div className={styles.foot}>
        <div className={styles.user}>
          <span className={styles.avatar}>{data.user.initials}</span>
          <span className={styles.ud}>
            <span className={styles.un}>{data.user.name}</span>
            <span className={styles.ue}>{data.user.email}</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
