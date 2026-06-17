# Desktop Electron shell — a thin native client for the Waypoint web UI

## Why

Waypoint is a cloud-hosted collaboration tool: the Node server and Postgres run as a separately
operated backend, and the web UI (`packages/web`, a Vite React SPA) is the human's window into the
decision inbox. Some humans want a dockable, always-available native window rather than a browser
tab — a desktop shell that opens to the inbox without juggling tabs.

Two decisions were parked and answered by the user:

- **Framework = Electron** (over Tauri/PWA). Electron is the most mature, lowest-friction way to
  wrap an existing web SPA in a desktop window with predictable cross-platform behaviour, and it
  matches the team's existing Node/TypeScript toolchain — no second language (Rust) to maintain.
- **Packaging = thin client** (over bundling the server). The desktop app does **not** embed the
  Node server or Postgres. It loads the web UI from a configurable URL pointed at a
  separately-run backend. This mirrors the production cloud topology exactly (the backend is a
  shared multi-project service, not a per-user local process), keeps the desktop build tiny, and
  avoids shipping a database or duplicating the server lifecycle.

## What changes

A new `packages/desktop` workspace — an Electron main process that opens a single secure
`BrowserWindow` loading the web UI from a resolved URL:

```
  user runs separately            packages/desktop (NEW, thin client)
  ────────────────────            ───────────────────────────────────
  Node server + Postgres ◀──http── BrowserWindow ◀── main.ts
  packages/web (Vite :5273) ◀──────  loads WAYPOINT_WEB_URL (default :5273)
                                     resolveWebUrl()  ← pure, unit-tested
```

- `packages/desktop/src/url.ts` — a **pure** `resolveWebUrl(env)` helper: returns
  `WAYPOINT_WEB_URL` when it is a valid http/https URL, the default `http://localhost:5273`
  when unset, and rejects malformed input rather than loading a bogus address. Isolated from
  Electron so it unit-tests without launching a window.
- `packages/desktop/src/main.ts` — Electron main: secure `webPreferences`
  (`contextIsolation: true`, `nodeIntegration: false`), sensible default window size, loads the
  resolved URL, and follows platform norms for `window-all-closed` / `activate`.
- `packages/desktop/package.json` — `@waypoint/desktop`, adds an `electron` devDependency
  (the only new dependency; approved with the framework decision).
- Root `package.json` workspaces gains `packages/desktop`.

The shell adds no contract, schema, or core/server/web source changes — it only frames the
existing web UI.

## Impact

- Affected specs: new capability `desktop-app`.
- Affected code: new `packages/desktop` workspace; root `package.json` workspaces array.
- New dependency: `electron` (devDependency of `@waypoint/desktop`). No CVEs at latest stable;
  flagged for human review per the dependency policy.
- No backend, DB, or web-source changes. The shell is purely additive.
