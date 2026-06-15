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
  web ───▶ shared                 web   — React/Vite spine + inbox UI (typed client + WS hook)
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
- **`packages/web`** — the project **spine** is the home: the live goal→plan→task tree with
  per-level state and rolled-up progress, where a decision card appears in place on the task it
  blocks. The **inbox** is a saved "needs you" lens over the same data at a stable
  `/projects/:id/inbox` route. Both update live over the WebSocket with resume-since-seq.

`openspec/` holds the specs (source of truth) and change proposals.

## Asks carry their own context

An agent doesn't just ask — it gives the human everything needed to answer in one glance, so
no context has to be re-derived. `park_ask` carries:

- **`rationale`** — why this needs deciding now.
- **per-option `consequence`** (DECISION) — what choosing each option commits to, shown beside
  the option. Options stay backward-compatible: a bare string or a `{ label, consequence }`.
- **`suggestedAnswers`** (QUESTION) — pick-first answers, so the human clicks instead of types.
- **`agentLabel`** — human-friendly provenance ("who parked it"); when omitted it resolves to a
  stable session-derived alias, never the raw session id.

The card also shows the **named work the ask blocks** and the **goal it ladders toward**
(walked from the node's ancestry). The human answers by intent: a DECISION picks an option; a
QUESTION takes a suggested answer or free text; a PROPOSAL gets **Approve / Adjust / Reject**,
where _Adjust_ is an approval that carries a constraint — recorded as one immutable event and
surfaced back to the agent via `get_context`, so it proceeds under the constraint rather than
making a fresh round-trip.

## The project spine

The home screen is the **spine**: the live goal → plan → task tree, so a human returning after
time away re-acquires context at a glance. Each level reports a derived state — a goal is
`on-track | at-risk | blocked`, a plan `active | blocked | done`, a task
`running | blocked-on-ask | done | failed` — with rolled-up progress (plans done, open asks),
all computed read-time in one transaction from data already stored (no projection, no N+1). A
decision card appears **in place on the task it blocks**, so you answer in context. Importance
(blast radius) is shown as visual weight, never by reordering; settled work collapses to the
live edge. The inbox is a saved "needs you" **lens** over the same data — `GET /v1/projects/:id/progress`
feeds the spine, and it refetches on the same WebSocket signal that drives the inbox.

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
