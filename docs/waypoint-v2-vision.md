# Waypoint V2 — vision

**Waypoint is the place a human steers a project that autonomous agents are building — dropping in to unblock a decision, dropping out, and on return knowing in seconds exactly where things stand.**

V1 proved the mechanism: an agent can park a decision over MCP, keep working on what's still unblocked, and a human can answer asynchronously. V2 is about making that mechanism _liveable_ — so a person who is in and out of the loop can answer with confidence and re-acquire context without effort.

---

## 1. The two goals

V2 is measured against exactly two goals, in the founder's words:

1. **Async collaboration without blocking.** Asynchronously defer agent decision points _and_ proposal reviews, so humans and agents collaborate without blocking on one another. An agent hits a fork → parks it → keeps working on still-unblocked tasks → the human answers whenever → the answer flows back.
2. **Three-level progress, for context re-entry.** Now that humans are _in and out_ of the loop, there must be a way to track project progress on three levels — **goal → plan → task** — or it is too hard to re-gather context when returning to async work.

Everything below serves one or both. If a feature serves neither, it is out of scope for V2.

---

## 2. What the V1 POC taught us

V1 shipped a working **decision inbox**: a flat list of ask-cards ranked by blast radius, answered live over a WebSocket. We dogfooded it and convened a four-lens design review (product, interaction, information, systems). The reviews converged hard on one diagnosis:

> The card answered _"what is being asked"_ and refused _"what do I need to know to answer."_

The founder's three complaints — _"the layout is uninformative,"_ _"the buttons don't reflect what I want,"_ _"I have to type long responses to questions I have no context about"_ — are not three problems. They are one. Strip the context from a decision and the human must either re-derive it (which is worse than synchronous) or compensate with prose (the typing tax). And the second goal — knowing _where we are_ on return — had **no surface at all** in V1.

The reframe that fixes both:

> **Stop sending questions to a person. Sit the person inside the project.**

---

## 3. The reframe: from inbox to project

V1's primary object is a **queue of questions**. V2's primary object is the **living project** — the goal → plan → task tree, showing where each agent is working right now and what changed while you were away. Decisions and proposals appear _in place_, pinned to the exact task that is stuck, carrying their context with them. The inbox does not disappear — it becomes a **lens** over the project ("just show me what needs me"), not the front door.

|                   | **Inbox-as-home (V1)**               | **Project-spine-as-home (V2)**             |
| ----------------- | ------------------------------------ | ------------------------------------------ |
| Primary object    | a queue of detached questions        | the live goal→plan→task project            |
| Answering         | re-derive context, then decide       | context is already on screen; decide       |
| Goal 2 (re-entry) | unserved — no project view exists    | the home screen _is_ the progress view     |
| Asks              | float in a flat list                 | hang off the task they block, in context   |
| Risk              | low effort, but doesn't serve goal 2 | larger build; tree must stay calm at scale |

**Decision: project-spine-as-home, inbox-as-lens.** It is the only shape that serves both goals with one surface. The cost — a bigger build and the need to keep a deep tree calm — is mitigated by collapsing to the live edge by default (§6) and keeping the flat inbox available as one saved lens for pure triage.

---

## 4. The product in one screen

```
 WAYPOINT   ·   Checkout & refunds v2                      on track · 2 need you
══════════════════════════════════════════════════════════════════════════════
 WHILE YOU WERE AWAY · 6h        +4 tasks done · 1 proposal approved · 2 new asks
──────────────────────────────────────────────────────────────────────────────
   ▸ billing-api          ▓▓▓▓▓▓▓░░   ●1 ◐2 ✓6        agent-α            ◀ 1 needs you
        ● idempotency key source — "event.id or payment_intent?"   blocks▸ refunds, receipts
   ▸ web-checkout         ▓▓▓▓░░░░░   ◐3 ✓3           agent-β            ◀ 1 needs you
        ◇ proposal — "Route refunds through the new webhook?"     Approve · Adjust · Reject
   ▸ telemetry            ▓▓▓▓▓▓▓▓▓   ✓ shipped                          —
──────────────────────────────────────────────────────────────────────────────
   ● blocked    ◐ active    ✓ done            goal stays fixed · done work dims · only change moves
```

One column, read top to bottom: **here is the aim, here is the work, here is the one place I'm needed.** The goal never moves. Completed work dims and settles. The only thing that draws the eye is what changed and what is blocked.

---

## 5. The information model — three levels

Each level carries explicit state; the levels roll up.

| Level    | Is                         | State                                      | Carries                                          |
| -------- | -------------------------- | ------------------------------------------ | ------------------------------------------------ |
| **Goal** | the durable intent         | `on-track · at-risk · blocked`             | % of plans done, count of open asks beneath      |
| **Plan** | a strategy toward the goal | `active · blocked · done`                  | owning agent, last activity, rolled-up open asks |
| **Task** | a unit of work             | `running · blocked-on-ask · done · failed` | the agent on it now, the ask(s) it spawned       |

**Asks attach to tasks.** An ask is never free-floating; it hangs off the task whose progress it blocks, inheriting that task's context (surrounding work, the diff, the why). Blast radius is computed from the dependency edges as today — but in V2 it is rendered as _weight and escalation_, never as a sort key.

**The event log becomes the story.** Every answer, decision, overturn, and transition already writes an immutable, sequenced event. In V2 those events are _threaded to their node_ and read back as narrative:

```
  09:12  agent-α  parked     "idempotency key source?"            on billing-api/charge
  09:48  you      decided    → payment_intent  (safest, no replay dup)
  09:48  agent-α  resumed    charge → refunds unblocked
  11:30  agent-β  proposed   "route refunds through new webhook"  on web-checkout/refunds
```

Same data, two views: the **live spine** (where we are) and the **while-you-were-away story** (what changed). Goal 2 is satisfied by a projection, not a new source of truth.

---

## 6. Storybook — a day with Waypoint

> Maya is shipping a **checkout & refunds** feature with two coding agents: **agent-α** on the billing API, **agent-β** on the web client. She has a life; she is in and out all day.

### Scene 1 — 08:40, the cold open (re-entry)

Maya opens her laptop. She does not see a list of questions. She sees the project as she left it, with the night's changes settled into it.

```
 WAYPOINT · Checkout & refunds v2                          on track · 2 need you
──────────────────────────────────────────────────────────────────────────────
 WHILE YOU WERE AWAY · since 23:10 last night
   ✓ 4 tasks done     auth-guard · webhook-verify · receipt-template · refund-calc
   ✓ 1 proposal approved by you, shipped     "version the public API under /v1"
   ● 2 new asks waiting        billing-api · web-checkout
──────────────────────────────────────────────────────────────────────────────
   ▸ billing-api      ▓▓▓▓▓▓▓░░   ●1 ◐2 ✓6     agent-α        ◀ needs you
   ▸ web-checkout     ▓▓▓▓░░░░░   ◐3 ✓3        agent-β        ◀ needs you
   ▸ telemetry        ▓▓▓▓▓▓▓▓▓   ✓ shipped                   —
```

> She reads one column in three seconds: _the aim held, four things finished, two need me._ No archaeology. **(Goal 2 · slice 2 + 3)**

### Scene 2 — 08:41, the twenty-second unblock

She clicks the blocked task on `billing-api`. The ask is already in context — she does not go anywhere to "open" it.

```
 billing-api / charge                                    parked by agent-α · 9h ago
 GOAL  Checkout & refunds v2                                  plan billing-api ▓▓▓▓▓▓▓░ 7/9
 ────────────────────────────────────────────────────────────────────────────────────
 WHY   Stripe can retry a webhook; we need one idempotency key. The source is ambiguous.
 ────────────────────────────────────────────────────────────────────────────────────
   ○ event.id            unblocks▸ refunds · receipts     ⚠ duplicates on replay
   ●>event.payment_intent unblocks▸ refunds · receipts    ✓ stable across retries — safest
   ○ composite key       unblocks▸ refunds · receipts     ⚠ needs a schema migration
 ────────────────────────────────────────────────────────────────────────────────────
   BLOCKS ▸ refunds · receipts                              [ choose ]   [ ask α why ]
```

> The consequence sits _beside_ each option; the safe path carries the single accent. She clicks **payment_intent** and is done. No typing. The card flips to "answered → α resuming," and on the spine `refunds` and `receipts` un-dim. **(Goal 1 · slice 1)**

### Scene 3 — 08:43, a proposal is not an essay

The `web-checkout` item is a proposal, not a question. The buttons match what a proposal actually is.

```
 web-checkout / refunds                                  proposed by agent-β · 2h ago
 PROPOSAL  Route refunds through the new webhook handler rather than the legacy poller.
 WHY       The poller adds ~30s latency and double-counts on retry; the webhook is idempotent now.
 AFFECTS   refunds · receipts · the nightly reconcile job
 ────────────────────────────────────────────────────────────────────────────────────
                                   [ Approve ]   [ Adjust… ]   [ Reject ]
```

> She clicks **Adjust…**, and _only then_ a single line opens. She types: _"yes, but keep the poller as a fallback for 30 days."_ That nuance is the exception, deliberately invited — not the default tax on every answer. **(Goal 1 · slice 1)**

### Scene 4 — 08:45, a question with the answer already half-written

The third ask is a genuine open question. The agent already knows the likely answers, so it offers them.

```
 telemetry / sampling                                    asked by agent-β · 40m ago
 QUESTION  What sampling rate for checkout traces in production?
 ────────────────────────────────────────────────────────────────────────────────────
   suggested ▸  [ 100% (low volume now) ]   [ 10% ]   [ 1% (match billing) ]
   or type ▸    ____________________________________________________
```

> She taps **100%** — a click, not a paragraph. Typing is the fallback, never the toll booth. **(Goal 1 · slice 1)**

### Scene 5 — 08:47, she closes the laptop; nothing stalls

Maya leaves. The agents do not wait on her for anything she has not yet answered.

```
  agent-α  ▸ idempotency answered → wiring refunds  (was blocked, now running)
  agent-β  ▸ proposal answered → adjusting; meanwhile building the receipts view (unblocked work)
  parked   ▸ "refund rounding: banker's or half-up?"  ← waits in the inbox, blocks nothing yet
```

> An agent that hits a new fork parks it and _moves to unblocked work_ rather than idling. The park is cheap; the human is never the critical path. **(Goal 1 · slice 1, existing V1 mechanism)**

### Scene 6 — 14:30, pulled in — but only when it matters

Maya is away from the desk. Most asks wait silently for her next visit. One does not: a decision whose blast radius just crossed her threshold.

```
  ▸ Waypoint · 1 high-impact decision
    "DB for the refund ledger?" blocks 5 tasks across billing-api + reconcile
    agent-α is on unblocked work, but 5 tasks converge here.
                                              [ open ]    [ later ]
```

> One push, not five. The digest of the smaller asks waits for her cadence. Tiered escalation by blast radius and age is what keeps Waypoint _worth opening_ instead of muted. She answers from her phone in two taps. **(Goal 1 + tiered attention · slice 3)**

### Scene 7 — 18:20, the day told as a story

Evening. Maya glances once more. The spine shows the feature nearly closed; the log narrates the day she half-watched.

```
 WHILE YOU WERE AWAY · since 14:30
   ✓ refunds shipped     ✓ receipts shipped     ◐ reconcile in progress
 ────────────────────────────────────────────────────────────────────────────────────
 THE STORY
   08:41 you decided   idempotency → payment_intent      → refunds, receipts unblocked
   08:43 you adjusted  refunds via webhook (+30d poller)  → β shipped 12:10
   14:31 you decided   refund ledger → Postgres            → 5 tasks unblocked
   16:55 agent-α       reconcile job failed once, retried, green
```

> She trusts what happened because she can _see_ it — an immutable thread of her decisions and the agents' moves. That trust is what makes stepping away possible. **(Goal 2 + trust · slice 3)**

---

## 7. Interaction principles (non-negotiable)

1. **Consequence beside the choice.** Every option shows what it commits you to and what it unblocks. The right answer should be self-evident _before_ the click.
2. **The action matches the intent.** Decision = options; proposal = Approve / Adjust / Reject; question = suggested answers first. Free text is an opt-in for nuance, never the default.
3. **Calm re-entry.** On return, only _change_ moves — done work dims, new asks rise; the goal is fixed. No charts, no red except a true blocker. Restraint is the feature.
4. **Weight, not position.** Importance (blast radius) is shown as visual weight and used to escalate attention — it does not reshuffle a list under the reader's eyes.

---

## 8. Architecture deltas (V1 → V2)

V2 extends the existing ports-and-adapters monorepo; the import direction (`web → shared`, `server → core → shared`) is unchanged, and `core` still names no driver or transport.

```
        shared            core                 server                 web
   ┌────────────┐   ┌──────────────┐    ┌──────────────────┐   ┌──────────────────┐
S1 │ +consequence│  │ richer ask    │    │ ask mapper +cols │   │ enriched card +  │
   │ +rationale  │→ │ read model    │ →  │ MCP intent args  │ → │ intent actions   │
   ├────────────┤   ├──────────────┤    ├──────────────────┤   ├──────────────────┤
S2 │ +project    │  │ listProject   │    │ REST /project    │   │ the spine screen │
   │  progress   │→ │ (3-level      │ →  │ progress rollup  │ → │ (home); inbox =  │
   │  DTOs       │  │  rollup)      │    │ over one tx      │   │ a saved lens     │
   ├────────────┤   ├──────────────┤    ├──────────────────┤   ├──────────────────┤
S3 │ +digest /   │  │ event-log →   │    │ notifier (tiered │   │ "while you were  │
   │  reentry    │→ │ story         │ →  │ + batched);      │ → │ away" + push     │
   │  DTOs       │  │ projection    │    │ reentry endpoint │   │ opt-in           │
   └────────────┘   └──────────────┘    └──────────────────┘   └──────────────────┘
```

- **shared** — new contracts only: per-option `consequence`, ask `rationale`, the three-level `ProjectProgress` DTO, the re-entry `Digest` DTO. Types inferred from zod, validated at every boundary, length-capped.
- **core** — new read models, no new write-path complexity: `listProject` (the 3-level rollup, one transaction, no N+1) and a `story`/`digest` projection over the existing append-only event log. The ask read model gains rationale + consequence + named blocked work + goal ancestry (cycle-guarded walk).
- **server** — one nullable-column migration for `rationale` (its own commit); the Postgres mappers; a `/v1/projects/:id/progress` read; a notifier adapter (tiered, batched) reading blast radius + ask age. No new transport.
- **web** — the spine becomes the home screen; the card is rebuilt around context + intent-matched actions; the inbox survives as a saved lens. The existing WebSocket delta stream drives live re-rank and the "while you were away" settling.

No relaxation of the boundaries; notifications and re-entry are projections of data already stored.

---

## 9. Roadmap — three slices, three OpenSpec changes

Each slice is independently shippable and demoable, and maps to scenes in §6.

| Slice | OpenSpec change                   | Delivers (scenes)                                 | Serves                                              |
| ----- | --------------------------------- | ------------------------------------------------- | --------------------------------------------------- |
| **1** | `decision-context-and-actions`    | enriched card + intent-matched actions (2, 3, 4)  | Goal 1 — kills the typing tax and the wrong buttons |
| **2** | `project-progress-spine`          | the 3-level spine home; inbox becomes a lens (1)  | Goal 2 — "where are we" exists                      |
| **3** | `async-reentry-and-notifications` | while-you-were-away story + tiered push (1, 6, 7) | Goals 1 + 2 — closes the async loop                 |

**Sequencing rationale.** Slice 1 first: highest leverage, lowest cost, and it directly retires the founder's stated pain — it can land on top of V1 immediately. Slice 2 next: it is the unbuilt half of the product (goal 2) and the new home everything else hangs on. Slice 3 last: re-entry and notifications are projections that need the spine and the enriched events beneath them to be meaningful.

- **Pros of this order** — each slice is shippable alone; pain is relieved on day one; later slices reuse earlier read models.
- **Cons / watch-items** — slice 1 lands inside the _old_ inbox shell, so its card design must survive being re-homed into the spine in slice 2 (design the card as a self-contained unit from the start).

---

## 10. Open questions

### Resolved by the design review — now owned in a slice

- **Multi-agent provenance** → **slice 1.** `park_ask` carries an optional human-friendly `agentLabel`; absent it, a stable session-derived alias. The story never shows a raw session id. Owned in slice 1 because the slice-3 story consumes it.
- **Proposal "Adjust" semantics** → **slice 1.** An Adjust is an approval carrying a constraint note — one immutable event, surfaced back to the agent via the answer result and `get_context`, not a new round-trip ask.
- **Rollup performance** → **slice 2.** The spine's read model is owned here, not deferred: implement the read-time rollup, measure against a realistic tree under an interactive budget, and fall back to a denormalized projection updated on event append if it misses. (Blast radius is direct-edge, so the cost is aggregation + the ancestor walk, not transitive closure.)
- **Notification testability** → **slice 3.** The model stays transport-agnostic behind a port, but the slice ships one concrete reference transport (web push first) so escalation is end-to-end testable. The notifier reads its escalation inputs through a `core` use-case, never raw SQL.
- **Principal pre-auth** → **slice 3.** The `last_seen` cursor keys on a well-known default principal via the existing seam, becoming per-user with no schema change when auth lands.

### Still genuinely open

1. **Spine vs. lens default** — is the spine the right _default_ home for every visit, or should a returning user land on the "while you were away" digest and step _into_ the spine? (Leaning: digest-on-return, spine-as-home otherwise.)
2. **Tree calm at scale** — beyond collapse-to-live-edge, what is the precise rule for what stays expanded at 50+ tasks?
3. **Notification transport choice** — which concrete transport is the default reference (web push vs. email vs. a chat webhook). Cadence and threshold must be user-set, not fixed.
4. **Auth boundary** — V2 still defers authn/authz, but the spine exposes more surface; confirm the `principal` seam covers project-scoped reads before this ships beyond a single tenant.

---

_This vision is the north star, not a contract. The OpenSpec changes under `openspec/changes/` are where each slice becomes a reviewed, testable commitment._
