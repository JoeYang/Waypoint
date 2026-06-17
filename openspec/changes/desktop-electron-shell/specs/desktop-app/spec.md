## ADDED Requirements

### Requirement: Desktop shell loads the web UI from a configurable backend URL

The desktop application SHALL be a thin Electron client that opens a single `BrowserWindow`
loading the existing Waypoint web UI from a configurable URL. It SHALL NOT bundle or start the
Node server or Postgres — those run separately, matching the cloud topology. The URL SHALL be
resolved from the environment by a pure function: when `WAYPOINT_WEB_URL` is set to a valid
`http`/`https` URL it is used; when unset the default `http://localhost:5273` is used; when set to
a malformed or non-http(s) value the function SHALL reject it with a clear error rather than load
a bogus address.

#### Scenario: Default URL when WAYPOINT_WEB_URL is unset

- **WHEN** the desktop app resolves its target URL and `WAYPOINT_WEB_URL` is not set
- **THEN** it resolves to `http://localhost:5273`

#### Scenario: Honour a configured WAYPOINT_WEB_URL

- **WHEN** `WAYPOINT_WEB_URL` is set to a valid `http`/`https` URL
- **THEN** the desktop app resolves to that URL and the window loads it

#### Scenario: Reject a malformed WAYPOINT_WEB_URL

- **WHEN** `WAYPOINT_WEB_URL` is set to a malformed or non-http(s) value
- **THEN** URL resolution fails with a clear error and the app does not load a bogus address

### Requirement: Desktop shell uses a secure window configuration

The Electron `BrowserWindow` SHALL be created with a secure web preferences configuration:
`contextIsolation` enabled and `nodeIntegration` disabled, so the loaded remote web UI cannot
reach Node or Electron internals. The shell SHALL follow per-platform lifecycle norms — quitting
when all windows close except on macOS, and re-creating a window on `activate` when none are open.

#### Scenario: Window is created with context isolation and no node integration

- **WHEN** the desktop app creates its main window
- **THEN** the window's web preferences enable `contextIsolation` and disable `nodeIntegration`

#### Scenario: Platform-appropriate window lifecycle

- **WHEN** all windows are closed on a non-macOS platform
- **THEN** the application quits; and **WHEN** the app is activated on macOS with no open window, a window is re-created
