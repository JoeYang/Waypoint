// The data seam. Screens read through a WaypointSource, never from fixtures or a network
// client directly — so the source can be swapped (mock → live backend) without touching any
// screen (design spec §4). This phase ships the synchronous mock; the wiring phase adds an
// async live source over the REST client + WS hook.

import { WP_DATA } from "./fixtures.js";
import type { ProjectsData } from "./types.js";

export interface WaypointSource {
  /** The full world snapshot the UI renders from. */
  getData(): ProjectsData;
}

export const mockSource: WaypointSource = {
  getData: () => WP_DATA,
};
