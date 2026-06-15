import { InboxScreen } from "./components/InboxScreen.js";
import { SpineScreen } from "./components/SpineScreen.js";
import type { WaypointStreamOptions } from "./inbox/useWaypointStream.js";
import styles from "./App.module.css";

interface AppProps {
  projectId?: string;
  baseUrl?: string;
  streamOptions?: WaypointStreamOptions; // injected in tests; defaults to the live transport
  route?: string; // injected in tests; defaults to window.location.pathname
}

// Is this the inbox lens route? The inbox stays a stable first-class path so V1 deep-links
// and tooling keep working; everything else is the project spine (the home).
function isInboxLens(path: string): boolean {
  return /\/inbox\/?$/.test(path);
}

// App chrome + the two surfaces. The project SPINE is the home (goal→plan→task, where things
// stand); the inbox is a saved "needs you" LENS over the same data, reachable from the spine
// at /projects/:id/inbox. Transport is injectable so tests stay hermetic.
export function App({
  projectId = "default",
  baseUrl = "",
  streamOptions,
  route,
}: AppProps = {}): React.JSX.Element {
  const path = route ?? (typeof window !== "undefined" ? window.location.pathname : "/");
  const lens = isInboxLens(path);
  const inboxHref = `/projects/${encodeURIComponent(projectId)}/inbox`;
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <span className={styles.wordmark}>Waypoint</span>
        <nav className={styles.nav}>
          {lens ? <a href="/">Project</a> : <a href={inboxHref}>Needs you</a>}
        </nav>
      </header>
      <main className={styles.main}>
        <h1>{lens ? "Inbox" : "Project"}</h1>
        {lens ? (
          <InboxScreen projectId={projectId} baseUrl={baseUrl} streamOptions={streamOptions} />
        ) : (
          <SpineScreen projectId={projectId} baseUrl={baseUrl} streamOptions={streamOptions} />
        )}
      </main>
    </div>
  );
}
