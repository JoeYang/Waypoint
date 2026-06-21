# Tasks

## 1. shared — contract (types first)

- [x] 1.1 `DigestActiveWorkSchema`, `DigestHeadsUpSchema` (+ `DigestHeadsUpKind`), `DigestTalliesSchema`
      in `packages/shared/src/reentry.ts`; extend `DigestAskSchema` with `risk`, `reversible`, `isNew`
      and `DigestSchema` with `activeWork`, `headsUp`, `tallies`. Inferred types exported.
- [x] 1.2 Contract test: a fully-populated digest parses; the new fields are required (a digest
      missing them is rejected); `headsUp.kind` is restricted to `danger|warning`.

## 2. core — projection (TDD red→green)

- [x] 2.1 `projectDigest`: stamp `risk`/`reversible`/`isNew` on each `waiting` row (`isNew` from the
      set of asks parked in the window).
- [x] 2.2 `projectDigest`: derive `activeWork` (task `ACTIVE` & not blocked-on-ask; carry the parent
      node as `streamId`/`streamTitle`), `headsUp` (open asks irreversible-or-high-risk, danger
      before warning), and `tallies` (task-kind nodes by derived state, discarded excluded).
- [x] 2.3 Unit tests: `isNew` boundary at the cursor; risk/reversible passthrough; `activeWork`
      excludes blocked/done/draft tasks; `headsUp` selects only irreversible/high-risk with correct
      `kind` and ordering; `tallies` count each bucket and exclude discarded; empty project →
      empty arrays + zero tallies; very long absence stays bounded by `REENTRY_PAGE_MAX`.

## 3. server + web — passthrough kept green (TDD)

- [x] 3.1 Server: confirm the REST digest endpoint returns the new fields (passthrough); add/extend
      a route test asserting `activeWork`/`headsUp`/`tallies` are present.
- [x] 3.2 Web: extend mock fixtures (`MOCK_DIGEST` / `fixtures.ts`) and any inline digests to the
      wider type; `npm test` green across all workspaces. No component/UI change.

## Follow-ups (separate changes)

- [ ] S2–S7 web surfaces consume these fields; S8 adds the per-option `recommended` flag (MCP gate).
