---
paths: ["packages/core/**"]
---
# Design principles (SOLID — bound to Waypoint's seams)

- **SRP** — one reason to change per module, tied to the 200-line commit cap. The ask
  lifecycle, the `blocked`/`blast_radius` computation, and the hierarchy rules are separate
  units; if a change smears across them, the boundary is wrong.
- **OCP** — a new transport (a 4th harness, a CLI) or a new ask `type` extends through the
  existing port/use-case interfaces, never by adding a `case` to a transport adapter. The
  extension points are: transport adapters, repository implementations, ask-state handlers.
- **LSP** — the in-memory port fakes used in tests must honour the SAME contract as the
  Postgres implementations *including* failure semantics (stale-version rejection,
  not-found). A test that passes on the fake but diverges on Postgres means the port
  contract is underspecified.
- **ISP** — keep ports narrow: `NodeRepository`, `AskRepository`, `EventLog`, `Clock` are
  separate. A use-case depends only on the ports it needs.
- **DIP** — `core` depends on its own port abstractions; `server` supplies the concrete
  Postgres/transport adapters. `core` never names a driver.

Enforcement: this rule → import-direction hook + `eslint-plugin-boundaries` → code-review
checklist with authority to bounce the change.
