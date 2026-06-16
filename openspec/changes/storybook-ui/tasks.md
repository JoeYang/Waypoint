Each numbered group is one PR (≤600 code lines; CSS counts; docs exempt). TDD red-first; `npm test` green
and `npx prettier --write .` before every commit. Interfaces/types land before the components that use them.
Tests query by role/label, not testid; cover empty/edge + a11y paths (frontend.md). Screens are prop-driven.

> Base-branch precondition (D4): this stacks on `feat/project-progress-spine`. Before merging the redesign
> to `main`, resolve the open "merge slice 2 vs stack" decision and rebase per agent-teams.md. Not a build blocker.

## 1a. Types + fixtures (PR1a — no behavior)

- [x] 1a.1 Reconcile `axiom-tokens.css` against the handoff `colors_and_type.css` — verified already identical (same palette + every var `waypoint-app.css` uses); no change needed.
- [x] 1a.2 Define `wp/types.ts` interfaces (ProjectsData, Project, Stream, Task, Decision, Option, Message, ActivityGroup, Notification) faithful to `WP_DATA`. Use `continuedDescription` (not `continued`); record the prototype→backend mapping in a comment. Model unions as discriminated unions (status, risk, impact.kind, notification.tone, message.who).
- [x] 1a.3 Port `wp/fixtures.ts` — typed `WP_DATA` (orbit-api, atlas-web, ledger-svc) exactly as in the prototype.
- [x] 1a.4 Test: a fixture-shape consistency check (all three projects satisfy the same shape; required fields present) — the drift guard standing in for zod this phase. 7 tests green.

## 1b. Source + provider + helpers (PR1b)

- [x] 1b.1 `WaypointSource` interface + synchronous `mockSource` (getData).
- [x] 1b.2 Pure nav + resolve/comment reducer (resolve threads the agent resume message + is a no-op once resolved; comment threads you+agent without resolving); wired in `WaypointProvider`.
- [x] 1b.3 `loadNav`/`saveNav` guard corrupt/absent/throwing storage (→ HOME_NAV); `safeNav` corrects a nav pointing at missing project/decision so the UI never renders blank; provider `resolve` no-ops an unknown id.
- [x] 1b.4 `wp/icons.tsx` (Icon + WaypointMark) + `wp/helpers.ts` (streamProgress/streamBarColor/taskIconName) with unit tests. 35 wp tests green.

## 2. App shell (PR2)

- [x] 2.1 `Sidebar` — brand→Home, project list (live/idle dot, count-pip, active), per-project nav with decision pip, user footer; rows are keyboard-operable `<button>`s; aria-labels on icon controls; aria-current on active. + AgentPill shared primitive. 6 tests.
- [x] 2.2 `TopBar` — breadcrumb, agent pill (working `· N tasks` | idle), clock, bell + unread dot (aria-label carries the count). 3 tests.
- [x] 2.3 `NotificationsPanel` — scrim + labelled dialog, tone icons, click→navigate (decision→proposal, fixing the prototype's map quirk), mark-all-read. 4 tests.
- [x] 2.4 Compose the shell in `App.tsx` (Sidebar + TopBar + view body + notifications overlay) on the provider; `main.tsx` mounts under `WaypointProvider`; per-view placeholder body until PR3-7. CSS modules per component. 3 shell tests. Verified live (screenshot).

## 3. Home (PR3)

- [ ] 3.1 RED: briefing banner (dismissible; copy from waiting count) + 4 stat tiles → implement.
- [ ] 3.2 RED: project cards (glyph, name, desc, agent pill, top-4 stream bars via CSS var width, footer waiting/caught-up + Open); click→map → implement.
- [ ] 3.3 Empty/edge: all-caught-up footer; idle project; Home CSS module.

## 4. Project map (PR4)

- [ ] 4.1 RED: `TaskNode` states (done/active/blocked/queued), "you are here" tag, "Decision parked", future-dashed connectors → implement.
- [ ] 4.2 RED: stream `lane`s with progress + horizontal track; blocked node is a `<button>`→proposal; resolved blocked → "resolved → resuming" → implement.
- [ ] 4.3 Map CSS module; legend.

## 5. Decision inbox (PR5)

- [ ] 5.1 RED: queue rows (risk icon, title, risk/rev/stream badges, "Agent recommends X. {first sentence}.", parked time, blocking badge) → implement.
- [ ] 5.2 RED: filter chips typed `"all" | "blocking" | "non-blocking"` (discriminated union — **fixes the prototype's `"non"` filter bug**) + "agent still working on N tasks" line → implement.
- [ ] 5.3 Empty states: nothing-waiting vs no-match-in-filter; inbox CSS module.

## 6a. Proposal detail (PR6a — static + selection)

- [ ] 6a.1 RED: proposal — badges, question, meta, "why this came up", option cards (pros/cons, recommends tag, radio select state), defer callout (info/danger) → implement.
- [ ] 6a.2 RED: actions — Approve recommendation / Apply {override} / reversible hint vs typed-confirmation badge; resolved banner → implement.
- [ ] 6a.3 Proposal CSS module.

## 6b. Thread + interactions (PR6b)

- [ ] 6b.1 RED: `Thread` — messages (agent/you/system), composer (`⌘↩` send, disabled-empty, aria) → implement.
- [ ] 6b.2 RED: resolve appends agent "Applied…/Resuming…" and flips state everywhere; comment appends you+agent reply without resolving; already-resolved is a no-op → implement.
- [ ] 6b.3 Thread CSS module.

## 7. Activity + Settings (PR7)

- [ ] 7.1 RED: `Activity` timeline — groups by time, dot kinds, stream tags, subs → implement.
- [ ] 7.2 RED: `Settings` — three toggle cards with local state (toggles are keyboard-operable, aria-pressed) → implement.
- [ ] 7.3 Activity + Settings CSS modules.

## 8. Mobile companion (PR8)

- [ ] 8.1 RED: phone-bezel overlay, per-decision cards across projects, reversible→Approve (local done) vs one-way→review-on-desktop, all-clear empty → implement.
- [ ] 8.2 Mobile CSS module.

## 9. Cleanup + docs (PR9)

- [ ] 9.1 Delete superseded `InboxScreen/List/Card`, `Spine`, `SpineScreen` + their tests; remove dead routes.
- [ ] 9.2 Update README + `docs/` to describe the new UI; full `npm test` + `npm run e2e` green; `openspec validate storybook-ui --strict`.
