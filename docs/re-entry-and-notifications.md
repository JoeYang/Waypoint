# Re-entry & notifications (V2 slice 3)

The async loop is only half a loop without a way to be _pulled in_ when it matters and a way to
_re-acquire context_ on return. This slice adds both, as **projections over the append-only event
log** — never a new source of truth, never an edited event.

## Components

| Concern                     | Where                                               | Notes                                                          |
| --------------------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| Story / digest projections  | `core` (`reentry.ts`)                               | Pure functions over loaded events/nodes/asks; bounded          |
| Escalation decision         | `core` (`reentry.ts`, `decideEscalation`)           | Pure: threshold → SLA → batch                                  |
| Cursor-aware use-cases      | `core` (`core.ts`)                                  | `digestFor` / `ackDigest` / `policyFor` / `evaluateEscalation` |
| Cursor + policy persistence | `core` port `CursorRepository`; `server` pg-backend | `principal_cursor`, `notification_policy` tables               |
| REST endpoints              | `server` (`rest/server.ts`)                         | digest, ack, story, notification-policy                        |
| Notifier                    | `server` (`ws/notifying-core.ts` + `hub.broadcast`) | emits `digest.ready`; best-effort                              |
| UI                          | `web` (`WhileYouWereAway.tsx`)                      | banner atop the spine + threaded story                         |

## Data flow

```
            append-only event log  (source of truth — never edited)
                       │
        ┌──────────────┼────────────────┐
   story()         digest()         evaluateEscalation()
  (narrative)   (since cursor)    (blast radius + age vs policy)
        │              │                  │
  GET /story    GET /digest          Notifier port
                + POST /digest/ack    ├─ WS digest.ready   ◀ this slice
                (explicit, monotonic) └─ web-push (VAPID)  ◀ later
        │              │                  │
        └──────────────┴──── web: While-you-were-away banner ────┘
```

## The read cursor

A per-principal `principal_cursor (principal, project_id, last_seen_seq)` row. The digest is
computed for events with `seq > last_seen_seq`. `GET /digest` is **read-only**; the cursor advances
only via `POST /digest/ack` (explicit, monotonic — an ack to an older seq is a no-op), mirroring the
WebSocket resume cursor, so two tabs can't race the digest empty. Pre-auth the principal is a
well-known default (`DEFAULT_PRINCIPAL`) via the `principal` seam; it becomes the authenticated user
with no schema change when auth lands.

## Tiered notifications

`notification_policy (principal, project_id, blast_radius_threshold, age_sla_seconds,
digest_cadence_seconds)` — user-set, defaulting to `DEFAULT_NOTIFICATION_POLICY`. On a parked ask
the notifier asks `core.evaluateEscalation` (which recomputes the ask's blast radius and age now)
and emits **one** `digest.ready` frame only when the policy says push (threshold or SLA) — never one
per ask. The frame carries the `seq` + a non-sensitive summary only (no prompt/PII). Both the live
delta and the escalation push are **best-effort**: a dead transport never fails the park, and the
durable log + digest-on-return remain the truth.

## Security

- Notifications and the digest log the `event.seq` and a non-sensitive summary — never tokens, PII,
  or decision payloads.
- Every query is project-scoped; the cursor/policy carry `project_id` (the tenant boundary) and
  `principal` (the future per-user boundary).
- The story actor is a stable alias derived from the session id, never the raw id.

## Transport trade-off

The WS `digest.ready` frame reaches a human only with an open tab; the durable digest-on-return
covers a closed laptop. Background OS delivery waits for the web-push adapter (a new dependency +
VAPID keys + a `push_subscription` table + a service worker) — deferred behind the same `Notifier`
port.
