# @waypoint/desktop

A thin [Electron](https://www.electronjs.org/) shell for the Waypoint web UI.

It opens a single native window that loads the existing web SPA (`packages/web`) from a
**separately-run backend**. It does **not** bundle or start the Node server or Postgres — that
matches the cloud topology, where the backend is a shared service rather than a per-user local
process.

## Run it

The desktop shell is a client only. Start the backend and the web UI first, then launch the
window:

1. **Backend** (Node server + Postgres) — run it as you normally do for development
   (see the repo root: `npm run db:up`, `npm run db:migrate`, then start the server).
2. **Web UI** — `npm run dev -w @waypoint/web` (serves the SPA on `http://localhost:5273`).
3. **Desktop shell** — install the Electron dependency once, then run the shell:

   ```sh
   npm install               # installs the electron devDependency
   npm run build -w @waypoint/desktop
   npm run dev -w @waypoint/desktop
   ```

## Configuration

| Variable           | Default                 | Purpose                                     |
| ------------------ | ----------------------- | ------------------------------------------- |
| `WAYPOINT_WEB_URL` | `http://localhost:5273` | The web UI origin the desktop window loads. |

Point the shell at any reachable web UI by setting `WAYPOINT_WEB_URL` to a valid `http`/`https`
URL, e.g. a deployed instance:

```sh
WAYPOINT_WEB_URL=https://waypoint.example.com npm run dev -w @waypoint/desktop
```

A malformed or non-http(s) value is rejected on startup rather than loading a bogus address.

## Security

The window uses Electron's secure defaults: `contextIsolation` is enabled and `nodeIntegration`
is disabled, so the loaded remote web UI cannot reach Node or Electron internals.
