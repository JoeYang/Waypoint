## 1. Schema (own commit, first)

- [x] 1.1 Add `0004_add_node_pr_url.up.sql` — `ALTER TABLE node ADD COLUMN pr_url text;`
- [x] 1.2 Add `0004_add_node_pr_url.down.sql` — `ALTER TABLE node DROP COLUMN pr_url;`

## 2. Shared contracts (own commit)

- [x] 2.1 Add `prUrl: z.string().url().optional()` to the `create_node` input shape in `mcp.ts`.
- [x] 2.2 Add `prUrl` to `NodeSchema` (nullable) in `node.ts`.
- [x] 2.3 Add `prUrl: z.string().nullable()` to `TaskProgressSchema` in `progress.ts`.

## 3. Core + repository (own commit, TDD red first)

- [x] 3.1 Red: a core test (in-memory backend) — `create_node` with a `prUrl` persists it and it
      appears on the task's `TaskProgress` in `listProject()`; without `prUrl` it is null.
- [x] 3.2 `core.createNode` accepts and persists `prUrl` on the node (default null).
- [x] 3.3 `buildTask` surfaces `prUrl` on the task progress entry.
- [x] 3.4 `pg-backend` `NodeRow` + `toNode` + INSERT/UPDATE carry `pr_url`.
- [x] 3.5 Green: build passes; `vitest run packages/core packages/shared packages/server/src/db` green.
