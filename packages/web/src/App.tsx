import { useState, type JSX } from "react";
import { useWaypoint } from "./wp/WaypointProvider.js";
import { Sidebar } from "./components/Sidebar.js";
import { TopBar } from "./components/TopBar.js";
import { NotificationsPanel } from "./components/NotificationsPanel.js";
import type { View } from "./wp/state.js";
import styles from "./App.module.css";

const VIEW_LABEL: Record<View, string> = {
  home: "All projects",
  map: "Project map",
  inbox: "Decisions",
  proposal: "Decision",
  activity: "Activity",
  settings: "Settings",
};

// Placeholder body until PR3–7 fill in the real screens (Home/Map/Inbox/Proposal/Activity/Settings).
function ViewBody(): JSX.Element {
  const { nav } = useWaypoint();
  return (
    <div className={styles.viewInner}>
      <p className={styles.placeholder}>{VIEW_LABEL[nav.view]} — coming in a later slice.</p>
    </div>
  );
}

// The persistent app shell: sidebar + (top bar / scrolling view), with the notifications
// popover overlaid. The mobile companion overlay is wired here and lands in PR8.
export function App(): JSX.Element {
  const [notifOpen, setNotifOpen] = useState(false);
  const [, setMobileOpen] = useState(false);

  return (
    <div className={styles.app}>
      <Sidebar onOpenMobile={() => setMobileOpen(true)} />
      <div className={styles.main}>
        <TopBar onBell={() => setNotifOpen((o) => !o)} />
        <div className={styles.view}>
          <ViewBody />
        </div>
      </div>
      {notifOpen ? <NotificationsPanel onClose={() => setNotifOpen(false)} /> : null}
    </div>
  );
}
