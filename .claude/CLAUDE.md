# Waypoint

An async decision inbox for coding agents: park the fork, keep working, answer when ready.
A cloud-hosted MCP collaboration tool — agents defer decisions to a human and continue on
unblocked work; the human answers asynchronously. See docs/waypoint-design-v3.html.

## Commands

| Action | Command |
|---|---|
| Build | `npm run build` (all workspaces) |
| Dev | `npm run dev` |
| Test | `npm test` (Vitest) |
| Test (single) | `npm test -- packages/core/src/ask/__tests__/lifecycle.test.ts` |
| E2E | `npm run e2e` (Playwright) |
| Lint | `npx eslint .` |
| Format | `npx prettier --write .` |
| DB migrate | `npm run db:migrate` |
| Specs | `openspec list` · `openspec validate` · `openspec archive <id>` |

## Architecture

npm-workspaces monorepo. Strict dependency direction — the domain core is transport- and
harness-neutral.

- `packages/shared/` — types & contracts (zod schemas + inferred types): node/ask/project/event, MCP tool schemas, REST DTOs. `zod` is its only runtime dep.
- `packages/core/`   — domain: hierarchy, ask lifecycle, computed `blocked` + `blast_radius`, optimistic concurrency. Depends ONLY on `shared`; talks to persistence through repository *ports* (interfaces).
- `packages/server/` — adapters: MCP (Streamable HTTP), REST, WebSocket; Postgres repository implementing core's ports; event emitter + cache. Depends on `core` + `shared`.
- `packages/web/`    — React/Vite. Two screens: Inbox + Blocking view. Typed API client + WebSocket hook. Depends on `shared`.
- `openspec/`        — specs (source of truth) + change proposals.

Import direction (enforced): `web → shared`, `server → core → shared`. `core` MUST NOT import `server`, `web`, or any DB/transport driver.

## Boundaries

### Always do
- Follow OpenSpec: a change proposal precedes implementation; archive it on completion.
- TDD — red test first. See @.claude/rules/testing.md.
- Run `npm test` before reporting work complete; `npx prettier --write .` before committing.
- One feature branch per change; never commit to main.

### Ask first
- Adding dependencies to any `package.json`.
- Changing an MCP tool contract or the DB schema (schema changes are their own commit).
- Relaxing the import-direction boundaries.

### Never do
- Push to main or master.
- Make `packages/core` import from `server`, `web`, or a DB/transport driver.
- Commit secrets or `.env` files; disable or skip tests.
- Use headless `claude -p` for the resume flow — resume stays interactive (product decision).

## Commit & PR size

Global ~/.claude/CLAUDE.md sets the commit rules (≤200 target / 400 hard max, single
logical change; interfaces, refactors, and schema each in their own commit). This project
adds the PR boundary and its enforcement:

- **One OpenSpec slice = one PR, capped at ~600 code lines** (docs/specs/lockfiles exempt).
  If a slice's diff would exceed the cap, split it into stacked per-layer PRs
  (`shared → core → server → web`), each independently reviewable and mergeable. This is the
  fix for oversized reviews — keep the layers shippable on their own.
- A `commit-size-guard` hook (`.claude/hooks/commit-size-guard.sh`) counts the staged diff
  on every `git commit`: it **warns past 200** and **blocks past 400** code lines. Override a
  justified exception with `WAYPOINT_ALLOW_BIG_COMMIT=1 git commit …`.

## Rules
@.claude/rules/architecture.md · testing.md · typescript.md · security.md · design.md ·
api-design.md · database.md · frontend.md · websocket.md · mcp-server.md · docker.md ·
agent-teams.md

> Global ~/.claude/CLAUDE.md governs TDD, Conventional Commits, branching, the security
> baseline, and model selection — not duplicated here.
