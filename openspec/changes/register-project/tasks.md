# Tasks

## 1. shared — contract (types first) — DONE

- [x] 1.1 `RegisterProjectInputSchema` (`projectId` slug, `name`) + `RegisterProjectResultSchema`
      (`id`, `name`, `created`) in `packages/shared/src/mcp.ts`, inferred types exported
- [x] 1.2 Contract test: valid input parses; bad slug / empty name / oversized name rejected

## 2. core — port + use-case (TDD red→green) — DONE

- [x] 2.1 `ProjectRepository.insert(project) → Promise<boolean>` (created?) on the port
- [x] 2.2 In-memory fake honours it (map-guarded; same contract as Postgres — LSP)
- [x] 2.3 `Core.registerProject(input)` use-case: build with injected clock, race-safe insert,
      return `{ project, created }`; idempotent (returns existing on re-register)
- [x] 2.4 Unit tests: creates a project (usable immediately); re-register returns existing with
      `created:false`; no event emitted

## 3. server — adapters (TDD red→green) — DONE

- [x] 3.1 pg-backend `ProjectRepository.insert` — `INSERT … ON CONFLICT (id) DO NOTHING`,
      `created` from rowCount
- [x] 3.2 MCP tool `register_project` wired to `core.registerProject`
- [x] 3.3 MCP tests: create + usable, idempotent re-register, boundary slug rejection
      (SDK returns an isError result); tool-list test updated to five tools
- [x] 3.4 Rebuilt image, recreated prod, verified the tool live over MCP
      (`register_project(default)` → `created:false`, name unchanged)

## Follow-ups (separate changes)

- [ ] REST `POST /v1/projects` for UI-driven project creation
- [ ] Mention `register_project` in the MCP `instructions` bootstrap for the multi-project flow
