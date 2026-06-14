import { InboxScreen } from "./components/InboxScreen.js";
import type { WaypointStreamOptions } from "./inbox/useWaypointStream.js";
import styles from "./App.module.css";

interface AppProps {
  projectId?: string;
  baseUrl?: string;
  streamOptions?: WaypointStreamOptions; // injected in tests; defaults to the live transport
}

// App chrome + the decision inbox. The Axiom-styled shell — warm paper, serif heading,
// hairline header — wraps the live InboxScreen. Transport is injectable so tests stay
// hermetic; production uses same-origin /v1 (proxied to the inbox API) and a real socket.
export function App({
  projectId = "default",
  baseUrl = "",
  streamOptions,
}: AppProps = {}): React.JSX.Element {
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <span className={styles.wordmark}>Waypoint</span>
        <span className={styles.tagline}>async decision inbox</span>
      </header>
      <main className={styles.main}>
        <h1>Decision inbox</h1>
        <InboxScreen projectId={projectId} baseUrl={baseUrl} streamOptions={streamOptions} />
      </main>
    </div>
  );
}
