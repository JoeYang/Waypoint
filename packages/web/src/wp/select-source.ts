// Chooses the data source at startup. With a backend base URL configured the app runs against
// the live backend; otherwise it falls back to the mock fixtures (the default for local UI work
// and the existing tests). The swap is invisible to every screen — the seam's whole point.

import { mockSource, type WaypointSource } from "./source.js";
import { createLiveSource } from "./live-source.js";

export function selectSource(apiBase: string | undefined): WaypointSource {
  const base = apiBase?.trim();
  return base ? createLiveSource(base) : mockSource;
}

// Resolve the API base the SPA should use, from build env + runtime origin:
//   1. an explicit VITE_WAYPOINT_API_BASE always wins (dev-against-live, e2e, custom deploys);
//   2. otherwise a PRODUCTION build defaults to its OWN origin — the prod container serves the
//      SPA and the REST/WS API from the same origin, so the deployed UI is live by default
//      (this is the fix for "prod shows mock data": the bundle had no env base baked in);
//   3. otherwise (a dev build with no explicit base) → undefined → the mock fixtures.
export function resolveApiBase(
  envBase: string | undefined,
  isProd: boolean,
  origin: string | undefined,
): string | undefined {
  const explicit = envBase?.trim();
  if (explicit) return explicit;
  if (isProd && origin) return origin;
  return undefined;
}
