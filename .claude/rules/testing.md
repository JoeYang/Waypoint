---
paths: ["packages/**/__tests__/**/*.ts", "packages/**/*.test.ts", "packages/**/*.test.tsx", "e2e/**"]
---
# Testing

TDD workflow: write failing test → implement → pass → refactor → re-run. Bug fixes start with
a failing regression test that reproduces the bug.

Use **Vitest** for unit/integration and **Playwright** (`npm run e2e`) for the two-screen UI
flows. Coverage target: **all logical paths** — every branch of the ask lifecycle, the
computed `blocked`/`blast_radius`, and the optimistic-concurrency guard. Run
`npm test -- --coverage`.

## Failure injection — required for every feature

- **Network/transport**: MCP/HTTP timeouts, dropped WebSocket, partial/malformed frames, reconnect + resume-since-seq.
- **Dependency**: Postgres unavailable, connection-pool exhaustion, transaction rollback.
- **Inputs**: missing required fields, invalid ask options, unknown project/node ids, oversized payloads.
- **Concurrency**: two agents writing the same node; stale `expected_version` → rejected, not lost; the overturn-while-DONE race.

Assert graceful degradation: meaningful error, clean state, no corruption, no silent failure.

## Conventions

- Test the domain `core` with in-memory port fakes — no DB needed for unit tests.
- Integration tests for `server` use a real Postgres (testcontainer or disposable schema), closed explicitly.
- Frontend: `@testing-library/react`; prefer `getByRole`/`getByLabelText` over `getByTestId`; mock the wire (`msw`), not internal functions.
- Never disable or skip a test — fix it.
