/**
 * Pure URL resolution for the desktop shell.
 *
 * Isolated from Electron so it can be unit-tested without launching a window.
 * The shell is a thin client: it loads the web UI from a backend that runs
 * separately, so the target URL must be resolvable from the environment alone.
 */

/** The web UI dev server origin, used when `WAYPOINT_WEB_URL` is unset. */
export const DEFAULT_WEB_URL = "http://localhost:5273";

/** Environment variable that overrides the web UI URL. */
export const WEB_URL_ENV = "WAYPOINT_WEB_URL";

/**
 * Resolve the web UI URL the desktop window should load.
 *
 * - Returns {@link DEFAULT_WEB_URL} when `WAYPOINT_WEB_URL` is unset or empty.
 * - Returns the configured value when it is a valid `http`/`https` URL.
 * - Throws when the configured value is malformed or not an http(s) URL, so the
 *   window never loads a bogus address.
 */
export function resolveWebUrl(env: Record<string, string | undefined>): string {
  const raw = env[WEB_URL_ENV];
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_WEB_URL;
  }

  const candidate = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`${WEB_URL_ENV} is not a valid URL: ${JSON.stringify(candidate)}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `${WEB_URL_ENV} must be an http(s) URL, got protocol ${JSON.stringify(parsed.protocol)}`,
    );
  }

  return parsed.toString();
}
