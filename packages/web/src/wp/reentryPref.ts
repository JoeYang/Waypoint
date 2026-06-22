// Persists which of the three re-entry surfaces (Briefing, Mission Control, Timeline) greets the
// returning human. A single UI preference in localStorage, mirroring the nav persistence in
// state.ts (loadNav/saveNav): an injectable storage for tests, and a safe fallback to the default
// on any corruption (unknown value, unparseable, throwing storage) so the surface never breaks.

export type ReentryDirection = "briefing" | "mission" | "timeline";

const DIRECTIONS: readonly ReentryDirection[] = ["briefing", "mission", "timeline"];

export const DEFAULT_DIRECTION: ReentryDirection = "briefing";

export const REENTRY_DIR_KEY = "wp.reentry.direction";

const isDirection = (v: unknown): v is ReentryDirection =>
  typeof v === "string" && (DIRECTIONS as readonly string[]).includes(v);

// Load the persisted direction; any corruption (missing, unknown value, throwing storage) →
// the default briefing surface.
export function loadDirection(storage: Pick<Storage, "getItem"> | undefined): ReentryDirection {
  try {
    const raw = storage?.getItem(REENTRY_DIR_KEY);
    return isDirection(raw) ? raw : DEFAULT_DIRECTION;
  } catch {
    return DEFAULT_DIRECTION;
  }
}

export function saveDirection(
  storage: Pick<Storage, "setItem"> | undefined,
  direction: ReentryDirection,
): void {
  try {
    storage?.setItem(REENTRY_DIR_KEY, direction);
  } catch {
    // storage unavailable (private mode, quota) — the choice just won't persist.
  }
}
