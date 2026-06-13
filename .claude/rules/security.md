# Security (strict)

Global ~/.claude/CLAUDE.md sets the baseline (no hardcoded secrets, OWASP Top 10,
least privilege, no PII in logs, standard crypto libs). This file adds the strict,
project-specific requirements for a cloud, multi-project service.

## Boundaries & input
- Validate **every** external input with zod at the boundary: MCP tool args, REST bodies, query params, WebSocket frames. Never trust harness-supplied data.
- All API paths versioned (`/v1`); consistent error envelope; never leak stack traces, internal ids, or SQL in responses.
- Parameterized queries only — no string-built SQL (no injection).

## Tenancy & authz (auth deferred, designed-in)
- Every row carries `project_id`; **every** query and mutation is scoped by project. Treat `project_id` as the future tenant boundary — never query across projects without an explicit, reviewed reason.
- Leave authn/authz seams in place (a `principal` passed to use-cases) even while auth is stubbed, so the gate drops in without a refactor.

## Secrets, crypto, logging
- Secrets (DB URL, future tokens) from env only; never committed, never logged.
- Use vetted crypto libs only; no custom crypto. TLS on all remote transports.
- **Audit log**: every human answer / decision / overturn is an immutable `event` row — append-only, never edited (decision archaeology).
- Logs must mask tokens/PII; log the `event.seq`, not payloads with sensitive content.

## Dependencies
- No deps with known CVEs; flag unmaintained packages for human review. Do not silently upgrade — escalate.
