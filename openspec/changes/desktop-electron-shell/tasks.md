One OpenSpec slice = one PR. TDD red-first for the pure helper; `npx prettier --write .` before
commit. The Electron main process is not unit-tested (no display in CI); its only non-trivial
logic is extracted into the pure, tested `resolveWebUrl` helper.

## 1. Workspace scaffold

- [x] 1.1 `packages/desktop/package.json` — `@waypoint/desktop`, private, `type: module`, adds the
      `electron` devDependency (approved framework decision), scripts `dev` (`electron .`) and
      `build` (`tsc -b`).
- [x] 1.2 `packages/desktop/tsconfig.json` — extends the repo base tsconfig like the other
      packages (Node lib, `outDir`/`rootDir`).
- [x] 1.3 Root `package.json` — add `packages/desktop` to the workspaces array.

## 2. Pure URL resolution (TDD)

- [x] 2.1 `resolveWebUrl(env)` in `packages/desktop/src/url.ts` — default `http://localhost:5273`;
      honour a valid `WAYPOINT_WEB_URL`; reject malformed/non-http(s) input with a clear error.
- [x] 2.2 Vitest unit tests: default, override, invalid (no Electron import in the tested module).

## 3. Electron shell

- [x] 3.1 `packages/desktop/src/main.ts` — secure `BrowserWindow` (`contextIsolation: true`,
      `nodeIntegration: false`), default size, loads `resolveWebUrl(process.env)`, handles
      `window-all-closed` / `activate` per platform norms.
- [x] 3.2 `packages/desktop/README.md` — run the backend + web, then
      `npm run dev -w @waypoint/desktop`.
