import styles from "./App.module.css";

// App chrome. The decision inbox mounts inside <main> (added in a later task); for now
// this establishes the Axiom-styled shell — warm paper, serif heading, hairline header.
export function App(): React.JSX.Element {
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <span className={styles.wordmark}>Waypoint</span>
        <span className={styles.tagline}>async decision inbox</span>
      </header>
      <main className={styles.main}>
        <h1>Decision inbox</h1>
        <p className="muted">Asks waiting on a human decision, most-blocking first.</p>
      </main>
    </div>
  );
}
