---
paths: ["packages/**"]
---
# Architecture — layering & import direction

Waypoint is a ports-and-adapters monorepo. The domain core is transport- and harness-neutral
so the same logic serves Claude Code, Codex, OpenCode, the REST API, and tests.

## Layers (dependency direction)

```
  web ───▶ shared
  server ──▶ core ──▶ shared
```

- `shared` — pure types/contracts. Depends on nothing.
- `core` — domain logic. Depends ONLY on `shared`. Reaches persistence through *ports*
  (interfaces it declares), never a concrete DB/driver.
- `server` — adapters (MCP, REST, WebSocket) + the Postgres repository that *implements*
  core's ports. Depends on `core` + `shared`.
- `web` — UI. Depends on `shared` (and the HTTP/WS wire), never on `core` or `server`.

## Forbidden imports (enforced)

- `core` MUST NOT import `server`, `web`, `pg`, an HTTP/WS library, or `process.env`.
- `web` MUST NOT import `core` or `server`.
- Cross-package imports go through a package's public entrypoint, never deep paths.

Enforcement stack: this rule → the import-direction PostToolUse hook (warns) →
`eslint-plugin-boundaries` (fails CI) → code-review checklist (semantic call).

## Ports (name the seams)

- `NodeRepository`, `AskRepository`, `EventLog` — declared in `core`, implemented in `server`.
- `Clock` — injected, never read from the OS in `core` (deterministic tests).
- Transport adapters (MCP/REST/WS) call `core` use-cases; they hold no domain logic.
