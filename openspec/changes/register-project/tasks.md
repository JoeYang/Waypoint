# Tasks

## 1. shared — contract (types first)

- [ ] 1.1 `RegisterProjectInputSchema` (`projectId` slug, `name`) + `RegisterProjectResultSchema`
      (`id`, `name`, `created`) in `packages/shared/src/mcp.ts`, inferred types exported
- [ ] 1.2 Contract test: valid input parses; bad slug / empty name rejected

## 2. core — port + use-case (TDD red→green)

- [ ] 2.1 `ProjectRepository.insert(project) → Promise<boolean>` (created?) on the port
- [ ] 2.2 In-memory fake honours it (map-guarded; same contract as Postgres — LSP)
- [ ] 2.3 `Core.registerProject(input)` use-case: build with injected clock, race-safe insert,
      return `{ project, created }`; idempotent (returns existing on re-register)
- [ ] 2.4 Unit tests: creates a project; re-register returns existing with `created:false`;
      no event emitted

## 3. server — adapters (TDD red→green)

- [ ] 3.1 pg-backend `ProjectRepository.insert` — `INSERT … ON CONFLICT (id) DO NOTHING`,
      `created` from rowCount
- [ ] 3.2 MCP tool `register_project` wired to `core.registerProject`
- [ ] 3.3 Integration test (pg): insert idempotency; MCP `register_project` create + re-register
- [ ] 3.4 Rebuild image, recreate prod, verify the tool live over MCP
