---
paths: ["packages/**/*.ts", "packages/**/*.tsx"]
---
# TypeScript

- `tsconfig` is **strict** (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). No loosening per-package.
- **No `any`.** Use `unknown` + a zod parse at boundaries. No non-null `!` assertions except in tests.
- Model state with **discriminated unions**, not boolean soups — the ask state
  (`OPEN | ASSUMED | ANSWERED | CONFIRMED | OVERTURNED | DISCARDED`) and node `status` are unions; switch exhaustively with a `never` default.
- Validate every external input (MCP tool args, REST bodies, WS frames, env) with **zod**; infer types from the schema, don't hand-write a parallel interface.
- Prefer `readonly` and immutable updates in `core`. Side effects live in adapters.
- Public package entrypoints export types explicitly; no deep cross-package imports.
- Errors are typed: a `Result`/tagged-error for domain failures (stale version, not-found, validation); throw only for programmer errors.
- No default exports; named exports only.
