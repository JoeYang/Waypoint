## Why

The async loop is only half a loop without two things V1 lacks: a way for the human to be _pulled in_
when it matters (without being spammed), and a way to _re-acquire context_ on return. Both founder goals
depend on this: async collaboration needs a trustworthy hand-back, and three-level progress needs a
"what changed while I was away" story so a returning human reorients in seconds and trusts what the
agents did unsupervised.

This change is **slice 3 of the V2 arc**. It turns the existing append-only event log into a narrative,
adds a "while you were away" re-entry briefing on top of the spine, and adds tiered, batched
notifications that escalate by impact and age — never one ping per ask.

## What Changes

- Add a **while-you-were-away** digest: derived from the event log since the human's last-seen seq, it
  summarizes what shipped, what's newly blocked, and what's waiting — across the three levels.
- Add the **project story**: the immutable events, threaded to their node, read back as a human-legible
  narrative ("you decided X → agent resumed → unblocked Y"). It is a projection, not a new source of truth.
- Add **tiered, batched notifications**: most asks wait silently for the next visit; a digest is delivered
  on the human's chosen cadence; a single push escalates only when an ask's blast radius crosses a
  threshold or it ages past an SLA. Thresholds and cadence are user-set. Never one notification per ask.

## Capabilities

### Added Capabilities

- `re-entry`: a while-you-were-away digest and a threaded project story, both projections over the
  append-only event log, so a returning human re-acquires context and trusts what happened.
- `notifications`: tiered, batched delivery that escalates by blast radius and age on a user-set cadence,
  so Waypoint is worth opening without becoming spam.

## Impact

- **Schema**: add a per-principal `last_seen_seq` (read cursor) so the digest can be computed since the
  last visit; nullable, its own migration, reversible. The event log itself is unchanged (append-only,
  never edited) — the story and digest are projections. **Pre-auth**, the cursor keys on a well-known
  default principal through the existing `principal` seam (mirroring `DEFAULT_PROJECT_ID`); the seam is
  the future per-user boundary, so the cursor becomes per-user with no schema change when auth lands.
- **Code**: `shared` gains the `Digest` and `StoryEntry` DTOs; `core` gains projections over `EventLog`
  (story since seq, digest since last-seen) **and the escalation-decision use-case**; `server` adds a
  re-entry endpoint and a notifier adapter that reads its escalation inputs (blast radius, ask age)
  **through a `core` use-case, never a raw DB query** — the notifier holds no domain logic; `web` adds the
  while-you-were-away panel atop the spine and an opt-in push subscription. Import direction unchanged.
- **Security**: notifications and the digest log the `event.seq`, never sensitive payloads; the digest is
  project-scoped through the `principal` seam. No secrets in transport; cadence/threshold are per-user.
- **Depends on**: the spine (slice 2), and slice 1's enriched events + stable `agentLabel` — the story is
  unreadable if the actor is a raw session id, so the label is owned in slice 1 and consumed here.
- **Open / transport**: the model stays transport-agnostic behind a `Notifier` port, but this slice ships
  **one concrete reference transport — a `digest.ready` frame over the existing WebSocket** — so the
  tiered escalation is end-to-end testable today with no new dependency (it reuses the resume-since-seq +
  heartbeat already in place). A web-push (VAPID) adapter, email, and chat-webhook are additional adapters
  behind the same port, later. Trade-off: the WS frame only reaches a human with an open tab; background
  delivery waits for the web-push adapter.
- **Decisions (from independent review)**: the read cursor lives in a **new `principal_cursor` table**
  keyed `(principal, project_id)` via the existing `principal` seam (not a column on an existing table),
  and advances by **explicit ack** (`GET /digest` is read-only; an ack endpoint advances it — consistent
  with the WS resume cursor). The `NotificationPolicy` (cadence, threshold, SLA) is a **persisted** entity,
  not just a DTO. The story actor is derived by **joining to `ask.agent_label`** / re-deriving the alias in
  the projection — the event table stays append-only with no `agentLabel` column added here. The escalation
  use-case depends on **both `AskRepository` and `NodeRepository`** (blast radius is recomputed at
  notify-time, not stored on the ask). The digest/story reads are **bounded by a window cap**.
