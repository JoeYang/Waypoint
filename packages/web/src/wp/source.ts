// The data seam. Screens read through a WaypointSource, never from fixtures or a network
// client directly — so the source can be swapped (mock → live backend) without touching any
// screen (design spec §4).
//
// The seam is async to admit a live backend, with a synchronous `initial()` seed: the mock
// returns its fixtures immediately (no loading flash, and synchronous tests stay green), while
// the live source returns null so the provider shows a loading state until `load()` resolves.
// `subscribe` lets a live source push (the WS delta) a re-load; the mock never fires it.

import { WP_DATA } from "./fixtures.js";
import type { ProjectsData } from "./types.js";

export interface WaypointSource {
  /** Synchronous first-paint snapshot, or null when only async data is available. */
  initial(): ProjectsData | null;
  /** Fetch (or refresh) the full world snapshot. */
  load(): Promise<ProjectsData>;
  /** Subscribe to live changes; the callback asks the provider to re-load. Returns an unsubscribe. */
  subscribe(onChange: () => void): () => void;
}

export const mockSource: WaypointSource = {
  initial: () => WP_DATA,
  load: () => Promise.resolve(WP_DATA),
  subscribe: () => () => {},
};
