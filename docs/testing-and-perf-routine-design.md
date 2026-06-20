# Waypoint — Test Routine, Fresh-Setup Dev Compose & Performance Suite

**Status:** Design / research (pre-implementation)
**Author:** generated for the `/goal` "build a test routine + fresh-setup dev compose + performance tests, iterate through all functionalities"
**Scope:** how Waypoint should be exercised end-to-end — a one-command fresh environment, a layered functional routine that walks every capability, and a performance suite with explicit budgets.
**Audience:** anyone extending Waypoint or wiring CI.

> This is a _design_ document. Implementation follows the project rule: an OpenSpec change
> proposal precedes code, and each slice ships as its own ≤600-line PR
> (`shared → core → server → web`). The phased plan in §10 maps directly onto those slices.

---

## 1. Goals & non-goals

### Goals

1. **Fresh-setup in one command.** `docker compose -f docker-compose.dev.yml up` (or `npm run env:fresh`) brings up the _entire_ stack — Postgres + server (MCP + REST + WS) + web — migrated and deterministically seeded, from a clean slate, with healthchecks gating readiness.
2. **A functional routine that iterates through every capability.** Not just the hero loop: a layered suite plus a single **full-surface walk** that exercises all 4 MCP tools, all 6 REST routes, the WS delta/resync/heartbeat path, the complete node and ask lifecycles, optimistic-concurrency conflicts, and the failure paths.
3. **A performance suite** with explicit SLOs (p50/p95/p99 latency, throughput, error rate, WS delivery lag), run against a large deterministic fixture, that _fails the build_ when a budget regresses.
4. **One orchestrated entry point** that provisions the fresh env, runs functional + perf, and tears down — locally and in CI.
5. **No regressions to the existing fast inner loop.** Vitest-against-TS-source stays the millisecond feedback path; the heavy routine is additive.

### Non-goals

- Replacing the existing Vitest unit/integration tests — we _extend_ them.
- Production load testing / capacity planning for a real deployment (this targets a single-host dev/CI box).
- Auth/multi-tenant load (authz is still stubbed; we test the `project_id` scoping that exists, not a real tenant boundary).
- Desktop (Electron) perf — out of scope; the shell wraps the same web UI.

---

## 2. Current state (what exists today)

| Area               | What's there                                                                                                                                                                                                                                                | Reference                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Unit / integration | Vitest, serial (`fileParallelism:false`) so integration tests share one Postgres; aliases resolve **TS source** (no build step). ~5k lines of tests across all packages (snapshot — drifts; don't anchor on it), heaviest in `core`. v8 coverage available. | `vitest.config.ts`, `package.json:19`             |
| E2E                | One Playwright suite — the hero loop (agent parks DECISION via MCP → browser answers → card clears → WS refetch). Starts Vite; reuses a running backend/Postgres.                                                                                           | `playwright.config.ts`, `e2e/hero-loop.e2e.ts`    |
| Dev DB             | `scripts/dev-db.sh` — user-owned `pg_ctl` cluster on **:55432** under `/tmp` (no Docker), idempotent, migrates + seeds in one pass.                                                                                                                         | `scripts/dev-db.sh`                               |
| Dev compose        | `docker-compose.yml` — **Postgres only** on :5432; app runs on host (`npm run dev`).                                                                                                                                                                        | `docker-compose.yml`                              |
| Prod compose       | `docker-compose.prod.yml` — full stack (app image + Postgres + volume), `@fastify/static` serves the web build via `WAYPOINT_WEB_ROOT`, strict `WAYPOINT_DB_PASSWORD`, CORS config.                                                                         | `docker-compose.prod.yml`                         |
| Seed scripts       | `dogfood-seed.mjs`, `onboard-waypoint.mjs`, `park-roadmap-decisions.mjs` — all drive **real MCP tools** (contracts enforced at runtime). `db:seed` is the SQL seeder.                                                                                       | `scripts/*.mjs`, `packages/server/src/db/seed.ts` |
| CI                 | **None.** No `.github/workflows`.                                                                                                                                                                                                                           | —                                                 |
| Performance tests  | **None.** No load tool, no budgets.                                                                                                                                                                                                                         | —                                                 |

### The three gaps this design closes

1. **No single fresh full-stack environment** for iterating — dev is host+pg*ctl \_or* pg-only compose; only _prod_ compose runs the whole app, and it's not seeded for testing.
2. **E2E covers one path.** The other ~90% of the surface (PROPOSAL/QUESTION asks, assume→confirm/overturn, DISCARD, concurrency conflicts, events pagination, WS resync, error envelopes) is only covered piecemeal at the unit layer, never walked end-to-end against the wire.
3. **Zero performance signal.** The read endpoints compute `blocked` + `blast_radius` over the graph and the WS hub fans out diffs — both are latency-sensitive and completely unmeasured.

---

## 3. Surface inventory — the things a routine must cover

This is the authoritative checklist the routine is measured against (the §9 matrix maps each row to a test).

**MCP tools (4)** — `packages/server/src/mcp/server.ts`

- `get_context(projectId)` — goal + ranked open asks + last-5 resolved decisions.
- `create_node(projectId, parentId?, kind, title, prUrl?, sessionId?)` — DRAFT/v1; parent must exist in project.
- `park_ask(projectId, nodeId, type, prompt, required, rationale?, risk, reversible, options?, suggestedAnswers?, agentLabel?, assumption?, sessionId?)` — DECISION needs ≥2 options.
- `transition(projectId, nodeId, to, reason?, expectedVersion, sessionId?)` — spine moves; `reason` required iff `DISCARDED`; optimistic guard.
- Typed errors on every tool: `NOT_FOUND`, `VALIDATION`, `STALE_VERSION` (carries `actualVersion`), `BACKEND_UNAVAILABLE`.

**REST routes (6 + health)** — `packages/server/src/rest/server.ts`

- `GET /healthz`
- `GET /v1/projects`
- `GET /v1/projects/:p/inbox` (ranked: blast_radius desc, ties oldest-first)
- `GET /v1/projects/:p/progress` (goal→plan→task spine with derived states)
- `GET /v1/projects/:p/events?sinceSeq=N` (append-only; returns the **tail 500 of events _after_ `sinceSeq`** — `listSince(p, sinceSeq).slice(-500)`, so `sinceSeq=0` on a 2000-event log returns events 1501–2000, _not_ the whole log)
- `POST /v1/projects/:p/asks/:a/answer` (DECISION→chosenOptionId, QUESTION→answerText, PROPOSAL→verdict[+adjustmentNote])
- Error envelope `{error,message,request_id}`; status map 404/400/409/503; `X-Request-ID` on every response.

**WebSocket** — `packages/server/src/ws/{server,hub,notifying-core}.ts`

- `ws://…/v1/projects/:p/stream`; client `resume{lastSeq|null}`.
- Server `delta{seq,upserts[],removedAskIds[]}` (only changed asks), `resync{reason}` (history gap / back-pressure).
- 30s ping/pong heartbeat; 1 MiB buffer cap → resync.

**Core lifecycle** — `packages/core/src/core.ts`

- Node: `DRAFT→{ACTIVE,DISCARDED}`, `ACTIVE→{DONE,DISCARDED}`, DONE/DISCARDED terminal.
- Ask: `OPEN→{ANSWERED,ASSUMED}`, `ASSUMED→{CONFIRMED,OVERTURNED}`; only `OPEN&required` blocks; OVERTURNED bumps node version.
- `blocked` = (≥1 required OPEN ask) OR (≥1 dependency not DONE).
- `blast_radius` = count of direct dependents.
- Optimistic concurrency via `expectedVersion` → `StaleVersionError(actualVersion)`.

**Persistence** — `packages/server/src/db/migrations/`

- Tables `project`, `node`, `ask`, `dependency`, `event`; every row carries `project_id`; `event` seq per-project monotonic + UNIQUE; CHECK constraints on enums + discard-reason.
- Migrations 0001→0004 (init, ask context, ask risk, node pr_url) — each has a `.down.sql`; `migrate.ts` exposes `revertLastMigration`.

**Tenancy & scoping** (`security.md` — `project_id` is the future tenant boundary)

- Every read/mutation is scoped by `project_id`. The **negative** property must be tested: project A's nodes/asks are invisible and immutable via project B's REST/MCP paths (e.g. `GET /v1/projects/B/inbox` must not surface A's asks; `park_ask`/`transition`/`answer` with an id from A under project B → `NOT_FOUND`, never a cross-project leak or mutation).

---

## 4. Architecture of the test routine

```
                       ┌───────────────────────────────────────────────┐
                       │              npm run test:routine               │
                       │   (orchestrator: provision → run → teardown)    │
                       └───────────────────┬───────────────────────────┘
                                           │
        ┌──────────────────────────────────┼───────────────────────────────┐
        ▼                                  ▼                                 ▼
┌───────────────┐              ┌──────────────────────┐          ┌────────────────────┐
│ FRESH ENV     │              │ FUNCTIONAL SUITE     │          │ PERFORMANCE SUITE  │
│ docker compose│  healthy →   │ (layered pyramid +   │  green → │ (k6 + MCP harness  │
│ -f dev.yml up │ ───────────► │  full-surface walk + │ ───────► │  vs large fixture, │
│ + seed        │              │  failure injection)  │          │  SLO thresholds)   │
└───────────────┘              └──────────────────────┘          └────────────────────┘
        │                                                                    │
        └─────────────────────────── teardown (volumes pruned) ─────────────┘
```

### The test pyramid (functional)

```
                    ▲ slower / fewer / higher-fidelity
        ┌───────────────────────────────────────────┐
        │  L5  Performance & chaos (k6, MCP harness) │   §6
        ├───────────────────────────────────────────┤
        │  L4  Full-surface walk (1 scripted journey │   §5.2
        │      over the live wire: MCP+REST+WS)      │
        ├───────────────────────────────────────────┤
        │  L3  E2E browser (Playwright: hero loop +  │   existing + §5.3
        │      PROPOSAL/QUESTION/overturn journeys)  │
        ├───────────────────────────────────────────┤
        │  L2  Adapter integration (REST/MCP/WS vs   │   exists, expand §5.1
        │      real Postgres) + failure injection    │
        ├───────────────────────────────────────────┤
        │  L1  Core domain units (lifecycle, blocked,│   exists
        │      blast_radius, concurrency)            │
        ├───────────────────────────────────────────┤
        │  L0  Contract tests (zod schemas, shared)  │   exists
        └───────────────────────────────────────────┘
                    ▼ faster / more / lower-fidelity
```

L0–L2 already exist and run on TS source in milliseconds — keep them as the inner loop. L4/L5 are the new artifacts and the heart of "iterate through all functionalities."

---

## 5. Functional routine design

### 5.1 Expand L2 adapter integration (close the coverage gaps)

Add targeted integration tests against the real Postgres for every uncovered cell in §9:

- **REST:** every route's success + each error status (404/400/409/503), `X-Request-ID` presence, `events?sinceSeq` pagination boundaries (0, last, beyond), inbox ranking ties (equal blast_radius → oldest first).
- **MCP:** each tool's success + each typed error; `STALE_VERSION.actualVersion` correctness; DECISION-needs-≥2-options validation; `reason`-required-iff-DISCARDED.
- **WS:** delta upsert/removal correctness, resync on stale `lastSeq`, heartbeat timeout, back-pressure → resync (already partially covered in `ws/__tests__`).
- **Cross-project isolation (security):** project A's ids return `NOT_FOUND` (never leak/mutate) when addressed under project B, across REST (`/inbox`, `/progress`, `/events`, `/answer`) and MCP (`park_ask`, `transition`, `get_context`). One dedicated test per surface — this is the top security property and is currently untested at every layer.
- **Migration rollback:** for each migration, apply → `revertLastMigration` → re-apply, asserting the schema is usable and no data is corrupted. `.down.sql` files have _zero_ coverage today and bit-rot silently; the fresh-compose env is where a broken down-migration first bites.

These stay in Vitest (serial, shared PG) — cheap, deterministic, no new tooling.

### 5.2 The full-surface walk (L4 — the new centerpiece)

A single ordered journey that drives the **live wire** of a freshly-seeded stack and asserts the observable contract at each step. It is the literal "iterate through all our functionalities" artifact.

**Why a dedicated walk and not more unit tests?** Unit tests prove each piece; the walk proves the pieces compose across process + transport + DB + WS exactly as an agent+human pair would drive them, against the same build a user runs. It is the acceptance gate for "the whole thing works."

```
 Agent (MCP client)                Server                    Human (REST + WS observer)
 ──────────────────                ──────                    ──────────────────────────
 get_context(empty)  ─────────────►  goal:null  ✓ empty
 create_node(goal)   ─────────────►  DRAFT v1
 transition(ACTIVE)  ─────────────►  ACTIVE v2
 create_node(plan,task×N)──────────► tree built
                                      │  ws delta ─────────► observer sees upserts
 park_ask(DECISION ≥2 opts)─────────► OPEN, node blocked
 park_ask(QUESTION+suggested)───────► OPEN
 park_ask(PROPOSAL)────────────────► OPEN
                                      │  GET /inbox ───────► ranked by blast_radius ✓
                                      │  GET /progress ────► derived states ✓
                                      │◄── POST answer(DECISION, chosenOptionId)
                                      │    ANSWERED, node unblocked
                                      │  ws delta ─────────► removedAskIds includes it ✓
                                      │◄── POST answer(QUESTION, answerText)
                                      │◄── POST answer(PROPOSAL, verdict=adjust+note)
 transition(stale expectedVersion)─► STALE_VERSION(actualVersion) ✓
 transition(unknown node)──────────► NOT_FOUND ✓
 transition(node under project B)──► NOT_FOUND ✓ (cross-project / tenant isolation)
 transition(task→DONE)─────────────► terminal ✓
 transition(task→DISCARDED,reason)─► failed state ✓
                                      │  GET /events?sinceSeq=0 ──► verb sequence + tail semantics ✓
                                      │  POST answer(unknown ask) ► 404 envelope ✓
                                      │  GET /healthz ─────► {status:"ok"} ✓
```

**As-built scope (bounded to what the wire actually exposes).** The walk drives only the
externally reachable surface, which turned out to be narrower than first sketched:

- **`OPEN→ANSWERED` only.** `assume`/`confirmAssumption`/`overturnAssumption` exist in `core`
  but have **no MCP tool and no REST route** — so `ASSUMED→CONFIRMED/OVERTURNED` is not
  reachable over the wire and stays L1 unit-tested, not walked.
- **No `resync` in the walk.** Resync only fires once the 256-snapshot ring evicts (>256
  events) or under back-pressure; forcing it over the wire is expensive and non-deterministic,
  so it stays L2 (unit-tested with a small `retain`). The walk asserts `delta` (snapshot +
  upsert-on-park + removal-on-answer).
- Added vs the sketch: explicit **NOT_FOUND** (unknown node), **cross-project isolation**
  (a node is invisible under another project id), and the **REST 404 envelope**.

**Implementation (as built — `scripts/walk.ts`):** a standalone TypeScript harness using the
MCP SDK client + global `fetch` + **Node 22's global `WebSocket`** (no `ws` dependency), run
via `node --experimental-strip-types` (the repo's existing `.ts`-script pattern) as
`npm run walk`, and **registered as a Vitest `pool: 'forks'` suite** (`npm run walk:ci`) so it
gets reporting/retries without sharing the serial PG pool — and without a headless browser it
has no use for. A declared-surface set (27 surfaces) fails the run on any silent coverage gap.
Assertions are explicit; best-effort cleanup keeps a shared dev project unpolluted.

**Determinism rules (resolves the §11 timestamp hazard up front):** the walk asserts only _ordering invariants_, never absolute wall-clock values — inbox order is checked by `blast_radius` desc, and oldest-first tie-breaks are made unambiguous by parking the relevant asks in distinct, awaited steps (so their creation order — not millisecond collisions — drives the tie). The `/events?sinceSeq` assertion checks the **verb sequence and tail semantics** (length may be < total log; returned `seq` is the latest), not a fixed event count.

### 5.3 E2E browser journeys (L3)

Extend Playwright beyond the hero loop with one journey per ask type and the overturn path, reusing the existing webServer config. Keep them serial against the seeded `default` project (they share the live WS).

### 5.4 Failure-injection lane (required by repo testing rules)

A dedicated lane asserting graceful degradation — no silent failures, clean envelopes:

| Fault               | Injected how                                             | Expected                                                                       |
| ------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| DB down mid-request | stop the `postgres` container / kill the pool            | REST 503 `BACKEND_UNAVAILABLE`; MCP `BACKEND_UNAVAILABLE`; no stack trace leak |
| Malformed input     | bad enum, missing required field, DECISION with 1 option | 400 `VALIDATION` at the zod boundary                                           |
| Stale write         | two writers, second uses old `expectedVersion`           | 409 `STALE_VERSION` with correct `actualVersion`                               |
| WS back-pressure    | slow consumer past 1 MiB buffer                          | server sends `resync`, doesn't OOM                                             |
| WS history gap      | reconnect with `lastSeq` older than retained window      | `resync{reason}`                                                               |
| Connection refused  | point client at a down port                              | typed client error, ret/timeout, no hang                                       |

`packages/server/src/db/__tests__/pg-failure*.test.ts` already seeds this lane — extend it to the transport edges above.

### 5.5 Orchestration & the daily Claude Code routine (as built)

The first foundation slice ships the loop end-to-end (design slices 1, 3, 6 → one OpenSpec
change `test-routine`):

- **`scripts/test-routine.sh`** (`npm run test:routine`) — provisions an **isolated throwaway
  database** (`waypoint_routine` on the dev `pg_ctl` cluster :55432) and a **server on
  dedicated ports** (18848/18849), builds only the server chain (`tsc -b packages/server`, so
  an unrelated in-progress web edit can't break it), runs the **full unit + integration suite**
  (`WAYPOINT_TEST_DATABASE_URL` flips the 16 integration tests on → 382/382, 0 skipped) and the
  **full-surface walk** against them, then always tears down (SIGTERM drain + `dropdb`) via a
  trap. Distinct DB + ports mean it is safe to run while `npm run dev` is up; the dev/dogfood
  data is never touched.
- **`scripts/daily-routine.sh`** (`npm run routine:daily`) — runs `test:routine`, captures the
  full output to `reports/test-routine/<stamp>.log`, distils a compact ANSI-free
  `reports/test-routine/<date>.md` (result + phase/suite summary + a triage prompt on failure),
  and fires a best-effort `notify-send`. It **only runs and records** — it changes no code.
  Reports are git-ignored run artifacts.
- **The daily Claude Code routine** (user-scheduled) — invokes `npm run routine:daily`, then
  reads the latest report + log to **reason about the outcome**: on green, a one-line ack; on
  red, it identifies the failing phase (build / migrate / suite / walk), the root cause, and the
  suspected `file:line`, and surfaces a triaged summary. **It does not edit source or open a PR
  — triage only** (the chosen risk posture for an unattended run). Headless `claude -p` is not
  used for Waypoint's resume flow; here Claude reasons over a finished report, which is fine.

Deferred to follow-up changes (design §5.1, §5.4, §6): the on-demand `docker-compose.dev.yml`
fresh env, the L2 coverage gaps, the failure-injection transport edges, and the k6 perf suite.

---

## 6. Performance suite design

### 6.1 What to measure (and why it matters here)

- **REST read latency** (`/inbox`, `/progress`) — these compute `blocked` + `blast_radius` over the project graph; cost grows with nodes + dependencies. _Primary risk surface._
- **MCP write throughput/latency** (`create_node`, `park_ask`, `transition`) — the only write path; each is a transaction + event append.
- **WS fan-out delivery lag** — time from a committed mutation to a `delta` frame arriving at N connected subscribers.
- **Events pagination** at depth (`?sinceSeq` over a long log).
- **Error rate** under concurrency (must stay ~0 except intentional conflicts).

### 6.2 Workload model — deterministic large fixture

A new `scripts/perf-seed.mjs` (driving real MCP tools, like the other seeders) builds a reproducible large project:

- 1 goal → ~20 plans → ~500 steps → ~10 000 tasks (tunable via env).
- ~1 000 open asks spread across nodes (mix of DECISION/QUESTION/PROPOSAL, varied risk/blast_radius).
- A dependency web (each task depends on 0–3 others) so `blast_radius`/`blocked` do real work.
- Deterministic — fixed structure, no randomness — so runs are comparable across commits.

### 6.3 Tooling split (see §8-B)

- **k6** for REST + WS — scriptable in JS, native WS support, and _thresholds-as-SLOs_ that fail the run on regression.
- **A Node MCP harness** (`scripts/perf-mcp.mjs`, MCP SDK + `p-limit`-style concurrency) for tool throughput. The MCP transport is `StreamableHTTPServerTransport` with `sessionIdGenerator: undefined` — stateless, one server+transport per request (`packages/server/src/mcp/http.ts`). k6 _could_ fire raw JSON-RPC POSTs for one-shot tool calls, but it would have to hand-roll the JSON-RPC envelope and parse SSE response framing; the MCP SDK client is the realistic, contract-faithful driver, so the harness is the right tool — not because MCP-over-k6 is impossible, but because the SSE framing makes it brittle.

```
            ┌──────────────┐   HTTP    ┌─────────────────────────────┐
   k6  ───► │ REST /v1/...  │ ────────► │  server  (MCP+REST+WS)      │
            │ WS  /stream   │ ◄──────── │  ─ computes blocked/blast   │ ──► Postgres
            └──────────────┘   frames   │  ─ WS hub fan-out           │     (10k-node
   MCP harness ─ JSON-RPC over Streamable-HTTP ─► tool calls ─────────┘      fixture)
        (create_node / park_ask / transition concurrency)
```

### 6.4 SLO budgets (starting targets — calibrate on first green run)

Thresholds encoded in the k6 script / harness; CI fails if breached.

| Scenario                                | Metric     | Budget (p95) | Notes                       |
| --------------------------------------- | ---------- | ------------ | --------------------------- |
| `GET /inbox` @ 10k nodes / 1k asks      | latency    | < 75 ms      | graph compute path          |
| `GET /progress` @ 10k nodes             | latency    | < 120 ms     | full spine + derived states |
| `GET /events?sinceSeq`                  | latency    | < 40 ms      | bounded 500                 |
| `create_node` (50 concurrent agents)    | latency    | < 100 ms     | txn + event append          |
| `park_ask` / `transition`               | latency    | < 100 ms     |                             |
| MCP write throughput                    | ops/s      | > 200 ops/s  | single host                 |
| WS delta delivery lag (100 subscribers) | lag        | < 200 ms     | mutation→frame              |
| Any scenario                            | error rate | < 0.1%       | excl. intentional 409s      |

These are deliberately conservative starting lines; the _first_ run records the real baseline and we tighten from there. The point is regression detection, not absolute numbers.

### 6.5 Output

- k6 summary (JSON + text) and the MCP harness percentiles archived as CI artifacts.
- A short `perf-smoke` profile (10s, low VUs, loose thresholds) runs on every PR; the **full** profile (large fixture, sustained load) runs nightly to avoid bloating PR CI time.

---

## 7. Fresh-setup dev compose design

Add **`docker-compose.dev.yml`** — a full-stack, deterministically-seeded, disposable environment. Distinct from the three existing flavors:

| File                               | Postgres      | App         | Web                   | Seed                  | Purpose                              |
| ---------------------------------- | ------------- | ----------- | --------------------- | --------------------- | ------------------------------------ |
| `docker-compose.yml` (today)       | ✓ :5432       | host        | host (Vite HMR)       | manual                | UI hacking with hot reload           |
| `scripts/dev-db.sh` (today)        | pg_ctl :55432 | host        | host                  | `db:seed`             | no-Docker host dev                   |
| **`docker-compose.dev.yml` (new)** | ✓ ephemeral   | ✓ container | ✓ via @fastify/static | deterministic fixture | **fresh full-stack for the routine** |
| `docker-compose.prod.yml` (today)  | ✓ volume      | ✓ container | ✓ static              | none                  | production-like keep-alive           |

**Shape of the new file:**

```
services:
  postgres:           # tmpfs-backed (ephemeral) for speed + clean slate each up
    image: docker.io/library/postgres:17-alpine
    tmpfs: [/var/lib/postgresql/data]
    healthcheck: pg_isready (gates dependents)
  app:                # MCP :8848 + REST/WS :8849 + serves web build (WAYPOINT_WEB_ROOT)
    depends_on: { postgres: { condition: service_healthy } }
    # NO separate migrate service: docker/entrypoint.sh already runs migrate.js
    # before exec'ing the server. Reuse it — don't double-migrate.
    healthcheck: GET /healthz
    ports: ["8848:8848","8849:8849"]
  seed:               # one-shot: drives the deterministic fixture over MCP, then exits 0
    depends_on: { app: { condition: service_healthy } }
    command: node scripts/<fixture|perf>-seed.mjs   # same dogfood-over-MCP pattern
```

Key properties:

- **Ephemeral DB (tmpfs)** → every `up` is a guaranteed clean slate, and disk I/O (the cause of an earlier machine stall) is avoided. A persistent-volume override stays available for manual exploration.
- **Migration via the existing entrypoint, not a new service.** The prod `docker/entrypoint.sh` already runs `migrate.js` before starting the server; adding a separate `migrate` service would migrate twice or force coupling compose to the image internals. The app gating on `postgres: service_healthy` already means it never races an unmigrated/unavailable DB — this fixes the "version skew / Couldn't reach Waypoint" startup class structurally without duplication.
- **Seed runs over MCP after `app: service_healthy`** — consistent with every existing seeder (contracts enforced at runtime), and never races the server.
- **`/healthz` healthcheck** on the app gates both the `seed` service and the orchestrator's "run tests now" signal — no arbitrary sleeps.
- **Reuses the prod `Dockerfile`** (built from the committed tree) so what we test is what we ship; only compose wiring + seed differ.
- **Podman-compatible**: fully-qualified image names (rootless podman needs them), works under `podman-compose`.

---

## 8. Key decisions (pros / cons)

### A — Fresh dev DB: ephemeral tmpfs vs persistent volume

- **Ephemeral tmpfs (chosen for the routine).** ✚ guaranteed clean slate, fast, no disk thrash. ✖ data gone on `down`; RAM use.
- Persistent volume. ✚ survives restarts, exploreable. ✖ state leaks between runs → flaky/non-reproducible perf + functional results.
- **Decision:** tmpfs for `docker-compose.dev.yml`; keep a `--volume` override for manual poking. Reproducibility wins for a test routine.

### B — Performance tool: k6 vs autocannon vs Artillery

- **k6 (chosen for HTTP+WS).** ✚ native WS, thresholds-as-SLOs (fails build), single static binary, JS scripting. ✖ Go binary dependency; not npm-native.
- autocannon. ✚ npm-native, simple. ✖ HTTP only — can't test the WS fan-out, our biggest unknown.
- Artillery. ✚ YAML scenarios, WS support. ✖ heavier config; thresholds less ergonomic than k6.
- **Decision:** k6 for REST+WS; a **Node MCP harness** for tool throughput (MCP's stateless Streamable-HTTP/SSE framing makes k6 brittle for it — see §6.3). Two tools, each on its strength.

### C — Full-stack dev: new compose vs extend prod compose with overrides

- **New `docker-compose.dev.yml` (chosen).** ✚ explicit, can't accidentally seed/expose prod; clear intent. ✖ a fourth compose file to maintain.
- Override file on prod compose. ✚ DRY. ✖ easy to misfire prod with dev seed; muddies the "never reuse prod creds" boundary in `docker.md`.
- **Decision:** separate file; share the `Dockerfile`, not the compose.

### D — Where the full-surface walk lives: Vitest-forks vs Playwright vs k6

- **Node TS harness registered as a Vitest `forks`-pool suite (chosen).** ✚ uses real MCP SDK + `ws` client (true contract); Vitest gives reporting + `test.retry()` + a `globalSetup` for env, with no browser runner; `forks` pool keeps it off the serial shared-PG pool; runnable standalone (`npm run walk`) for fast local iteration. ✖ a separate Vitest project config.
- Wrap it as a Playwright test. ✖ the walk is headless (no DOM/screenshots) — Playwright's browser machinery buys nothing here; pure overhead. _(Rejected on review.)_
- Pure k6. ✖ can't drive MCP cleanly; assertions weaker than a typed harness.
- **Decision:** TS harness as a standalone script _and_ a Vitest forks-pool suite. Playwright stays for the genuinely browser-driven L3 journeys only.

### E — CI Postgres: service container vs compose-in-CI

- **GitHub Actions `services: postgres` (chosen for L0–L3).** ✚ fast, native, matches the serial-shared-PG model. ✖ not the containerized app.
- Compose-in-CI (for L4/L5). ✚ tests the real image. ✖ slower.
- **Decision:** unit/integration/e2e use a PG service container; the full-surface walk + perf-smoke use `docker-compose.dev.yml`. Best of both.

---

## 9. Coverage matrix (functionality → layer → artifact)

| Functionality                                                 | L0  | L1  | L2  | L3  | L4 walk | L5 perf |
| ------------------------------------------------------------- | :-: | :-: | :-: | :-: | :-----: | :-----: |
| zod contracts (node/ask/project/event/DTOs)                   |  ✓  |     |     |     |         |         |
| node lifecycle transitions (legal + illegal)                  |     |  ✓  |  ✓  |     |    ✓    |         |
| ask OPEN→ANSWERED (DECISION/QUESTION/PROPOSAL)                |     |  ✓  |  ✓  |  ✓  |    ✓    |         |
| ask ASSUMED→CONFIRMED/OVERTURNED (core-only, unrouted)        |     |  ✓  |  ✓  |     |         |         |
| `blocked` + `blast_radius` computation                        |     |  ✓  |  ✓  |     |    ✓    |    ✓    |
| optimistic concurrency / STALE_VERSION                        |     |  ✓  |  ✓  |     |    ✓    |         |
| MCP get_context / create_node / park_ask / transition         |     |     |  ✓  |     |    ✓    |    ✓    |
| MCP typed errors (NOT_FOUND/VALIDATION/STALE/BACKEND)         |     |     |  ✓  |     |    ✓    |         |
| REST /projects /inbox /progress /events /answer /healthz      |     |     |  ✓  |  ✓  |    ✓    |    ✓    |
| REST error envelope + status map + X-Request-ID               |     |     |  ✓  |     |    ✓    |         |
| WS delta / removedAskIds                                      |     |     |  ✓  |  ✓  |    ✓    |    ✓    |
| WS resync (history gap, back-pressure; needs >256 events)     |     |     |  ✓  |     |         |         |
| WS connect + resume snapshot                                  |     |     |  ✓  |     |    ✓    |         |
| WS heartbeat / reconnect-gap resume                           |     |     |  ✓  |     |         |         |
| persistence: project scoping, seq monotonicity, audit append  |     |  ✓  |  ✓  |     |    ✓    |         |
| **cross-project isolation (A's ids → NOT_FOUND under B)**     |     |  ✓  |  ✓  |     |    ✓    |         |
| **migration rollback (apply→revert→re-apply, no corruption)** |     |     |  ✓  |     |         |         |
| failure injection (DB down, malformed, conflict)              |     |     |  ✓  |     |    ✓    |    ✓    |
| inbox ranking (blast_radius desc, oldest-first ties)          |     |  ✓  |  ✓  |     |    ✓    |    ✓    |

Empty cells are intentional (a contract test needn't run under load). Any _row_ with no ✓ is a coverage hole — the routine's exit report prints the matrix so holes are visible.

---

## 10. Phased implementation plan (OpenSpec slices)

Each phase = one OpenSpec change + one ≤600-line PR. TDD red-first throughout.

1. **`test-fresh-compose`** — `docker-compose.dev.yml` + deterministic seed + `npm run env:fresh`. Reuses the app image's existing entrypoint migration (no separate migrate service — see §7). Server-layer only (compose + scripts). _Unblocks everything else._
2. **`test-l2-coverage`** — fill the REST/MCP/WS integration gaps in §5.1, including the cross-project isolation and migration-rollback tests (server tests). No production code unless a gap reveals a bug (then red test → fix).
3. **`test-surface-walk`** — the L4 harness (`scripts/walk.ts`) + Vitest forks-pool suite + matrix reporter. `npm run walk`.
4. **`test-failure-lane`** — extend failure-injection to the transport edges (§5.4).
5. **`perf-seed-and-harness`** — `scripts/perf-seed.mjs` + `scripts/perf-mcp.mjs` + k6 scripts + SLO thresholds + `npm run perf` / `perf:smoke`.
6. **`test-orchestrator-and-ci`** — `npm run test:routine` (provision→run→teardown) + `.github/workflows/ci.yml` (lint → typecheck → unit/integration → e2e → walk → perf-smoke; nightly full perf).

Dependencies: 1 → {2,3,5}; 3 → 6; 5 → 6.

```
[1 fresh-compose] ─┬─► [2 l2-coverage] ─────────────┐
                   ├─► [3 surface-walk] ─────────────┼─► [6 orchestrator + CI]
                   └─► [5 perf-seed+harness] ─► ......┘
                       [4 failure-lane] (parallel, off 1)
```

---

## 11. Risks & open questions

- **k6 as a new dependency** — it's a binary, not an npm dep, but it's still a tool to install in CI. _Open:_ accept k6, or stay npm-pure with autocannon + a custom WS latency probe (loses thresholds-as-SLOs)? → recommend k6; flag for approval per "ask first: adding dependencies."
- **Serial-shared-PG vs the containerized app** — L0–L3 assume one shared PG; the walk/perf use the compose stack. Keep them in separate CI jobs so their DB assumptions don't collide.
- **SLO calibration** — first numbers are guesses; the initial green run sets the real baseline. Budgets must be committed _after_ that run, not before.
- **Fixture scale vs CI time** — 10k nodes may be too heavy for PR CI; that's why perf-full is nightly and PR runs `perf:smoke` only.
- **MCP Streamable-HTTP under load** — the transport is stateless (one server+transport per request, `sessionIdGenerator: undefined`), so there are no long-lived SSE sessions to exhaust; the harness is still the first real _write_ concurrency test and may surface pool/transaction contention.
- **Determinism of derived states** — _resolved_ in §5.2: the walk asserts ordering invariants and tail semantics, never absolute timestamps, and disambiguates tie-breaks by awaited step order. Remaining watch item: if a future endpoint sorts purely by `lastActivityAt`, revisit.

---

## 12. Appendix — new files & commands

**New files**

```
docker-compose.dev.yml             # fresh full-stack, ephemeral, seeded
scripts/walk.ts                    # L4 full-surface walk harness (standalone + Vitest forks suite)
scripts/perf-seed.mjs              # deterministic 10k-node fixture (via MCP)
scripts/perf-mcp.mjs               # MCP write-throughput harness
perf/rest.js  perf/ws.js           # k6 scripts (thresholds = SLOs)
vitest.walk.config.ts              # forks-pool project that runs the walk in CI
.github/workflows/ci.yml           # lint→typecheck→unit→e2e→walk→perf-smoke
```

**New npm scripts**

```
env:fresh     docker compose -f docker-compose.dev.yml up --wait
env:down      docker compose -f docker-compose.dev.yml down -v
walk          tsx scripts/walk.ts            # full-surface walk, standalone
perf:smoke    k6 run perf/rest.js (10s, loose) + perf-mcp smoke
perf          k6 run full + perf-mcp full (against perf-seed fixture)
test:routine  env:fresh → (e2e + walk + perf:smoke) → env:down
```
