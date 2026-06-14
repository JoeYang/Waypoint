# Waypoint

An async decision inbox for coding agents: **park the fork, keep working, answer when ready.**

When an AI coding agent hits a decision it shouldn't make alone — a dependency choice, an API
shape, a product trade-off — it _parks an ask_ over MCP and proceeds on unblocked work instead
of stalling. A human sees the parked decisions ranked by how much work each blocks, answers
asynchronously, and the answer flows back to the agent. The agent never loses context; the
human is never the bottleneck.

See [`docs/waypoint-design-v3.html`](docs/waypoint-design-v3.html) for the full product design.

## Architecture

An npm-workspaces monorepo with a strict, one-way dependency direction. The domain core is
transport- and harness-neutral — the same logic serves MCP, REST, and the web UI.

```
  web ───▶ shared                 web   — React/Vite inbox UI (typed API client + WS hook)
  server ──▶ core ──▶ shared      server— MCP + REST + WebSocket adapters; Postgres repository
                                  core  — ask lifecycle, computed blocked / blast_radius
                                  shared— zod contracts + inferred types (only runtime dep: zod)
```

- **`packages/shared`** — the wire contracts: node / ask / project / event schemas, MCP tool
  args, REST + WebSocket DTOs. Types are inferred from the zod schemas, never hand-written.
- **`packages/core`** — the domain: node hierarchy, the ask state machine
  (`OPEN → ASSUMED → CONFIRMED/OVERTURNED`, `OPEN → ANSWERED`, `DISCARDED`), computed
  `blocked` + `blast_radius`, and optimistic concurrency. Reaches persistence only through
  repository _ports_ it declares; it names no driver, transport, or `process.env`.
- **`packages/server`** — the adapters that implement those ports: an MCP Streamable-HTTP
  server for agents, a Fastify REST API + a WebSocket delta stream for the human, and a
  transactional Postgres repository. One shared `InboxHub` behind a notifying core means every
  committed mutation — whether an agent parks over MCP or a human answers over REST — pushes a
  live delta to connected UIs.
- **`packages/web`** — the two-screen inbox: cards ranked by blast radius, answered live over
  the WebSocket with resume-since-seq on reconnect.

`openspec/` holds the specs (source of truth) and change proposals.

## Develop

Requires **Node ≥ 22**. Postgres runs as a user-owned cluster — no Docker, no sudo.

```bash
npm install
npm run db:up        # start local Postgres (:55432), migrate, seed the default project
npm run build        # tsc -b across all workspaces

# terminal 1 — the agent + human backend (MCP :8848, REST + WS :8849)
DATABASE_URL=postgresql://waypoint@localhost:55432/waypoint npm start -w @waypoint/server

# terminal 2 — the web inbox (:5273, proxies /v1 → :8849)
npm run dev -w @waypoint/web
```

To watch the loop end to end, seed Waypoint's own build structure through the live MCP tools:

```bash
npm run dogfood:seed   # creates the goal + plan nodes via the real agent-facing MCP surface
```

## Test

```bash
npm test                 # Vitest — unit + integration (DB tests skip unless a test DB is set)
npm test -- --coverage   # all logical paths: lifecycle, blocked/blast_radius, concurrency
npm run e2e              # Playwright — park via MCP → answer in the browser → live removal
npx eslint .            # import-direction layering is lint-enforced
```

Domain `core` is tested against in-memory port fakes (no DB needed). The Postgres integration
tests run only when `WAYPOINT_TEST_DATABASE_URL` points at a **throwaway** database — they
`TRUNCATE` between cases, so they never touch the dev/dogfood data.

## Operate

| Action                     | Command                                                                       |
| -------------------------- | ----------------------------------------------------------------------------- |
| Migrate up                 | `npm run db:migrate`                                                          |
| Migrate down (revert last) | `npm run db:migrate down`                                                     |
| Seed default project       | `npm run db:seed`                                                             |
| Format · lint              | `npx prettier --write .` · `npx eslint .`                                     |
| Specs                      | `openspec list` · `openspec validate <id> --strict` · `openspec archive <id>` |

`DATABASE_URL` is read from the environment only — never committed, never logged.
