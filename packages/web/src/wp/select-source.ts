// Chooses the data source at startup. With a backend base URL configured the app runs against
// the live backend; otherwise it falls back to the mock fixtures (the default for local UI work
// and the existing tests). The swap is invisible to every screen — the seam's whole point.

import { mockSource, type WaypointSource } from "./source.js";
import { createLiveSource } from "./live-source.js";

export function selectSource(apiBase: string | undefined): WaypointSource {
  const base = apiBase?.trim();
  return base ? createLiveSource(base) : mockSource;
}
