# Waypoint deck — outline & system

**Product:** Waypoint — "An interactive plane between human and agents."
A web app that sits between a developer and their long-running coding agent (Claude Code).
Solves two problems:
1. **Async decision parking** — instead of the agent blocking in the TUI asking a y/n, it
   *parks* the decision to Waypoint and keeps working on tasks that aren't blocked by it.
   Work never stalls on a single approval.
2. **Project map + annotation** — visualize the plan and where the agent currently is, so you
   can jump in and out of a session without rebuilding context.

**Audience:** potential users / developers. **Length:** 15–20 min (~20 slides).
**Goal:** problem framing → UI walkthrough. **Fidelity:** hi-fi, realistic web screens.
**Platform:** desktop web app. **Theme:** light (warm paper). **Variations:** map + decision view.

## Design system — Axiom
- Paper bg `--paper-50` #fbfaf7; cards white w/ 1px `--border` hairline, 6px radius, NO shadow.
- Ink text `--ink-900`. Single indigo accent `--accent-500` #3b4cad. Semantic muted red/amber/green/teal.
- Serif (Source Serif 4) for titles/headings; Inter Tight sans for body/UI; JetBrains Mono for code/labels.
- Sentence case everywhere. No emoji. Lucide icons (1.5px). Unicode arrows → ← for prose.
- Slides 1920×1080 via deck-stage. Type scale & padding as CSS vars.

## Brand mark (Waypoint)
Diamond decision-node on a path — outline diamond w/ center dot, ink stroke. Wordmark in serif.
NOT the Axiom logo (that's the design system, not the product).

## Slide system / parallelism
- Title: centered-ish, eyebrow + serif title + serif italic lead.
- Section dividers: paper-100 bg, § number + big serif title. Identical layout each time.
- Hero UI slides: small eyebrow + title top-left, app screen fills the rest in a framed app shell.
- Annotated slides: app shell + numbered callout chips pointing to UI parts.
- Variation slides: two app frames side by side w/ labels "A / B".
- Footer rail w/ waypoint mark + page num, consistent.
- Accent used sparingly: current/active state, recommendation highlight, "you are here".

## Type scale (CSS vars, 1920×1080)
--type-title 116px (title slide), --type-heading 64px, --type-eyebrow 22px,
--type-lead 38px, --type-body 30px, --type-small 24px (floor), mono labels 18–20px.
pad 96px x / 80px y.

## Title sequence (sentence-case topic phrases + a few brief statements)
01  Waypoint — An interactive plane between human and agents        [title]
02  § 01 · The problem                                              [divider]
03  Agents now run for hours, not minutes                           [setup, big figure/stat]
04  One unanswered question stalls the whole run                    [problem 1]
05  A single approval freezes the tasks behind it                   [figure: blocked TUI + idle queue]
06  Re-entering a session means rebuilding context                  [problem 2]
07  § 02 · The idea                                                 [divider]
08  Waypoint sits between you and the agent                         [plane diagram]
09  Two moves: park the decision, map the work                      [two-mechanism overview]
10  § 03 · Track where the work is                                  [divider]
11  The project map                                                 [HERO — project map]
12  Every node shows its status — and where you left off            [annotation close-up]
13  Two ways to read the plan                                       [VARIATION — map: flow vs outline]
14  § 04 · How decisions reach you                                  [divider]
15  The decision inbox                                              [HERO — parking queue]
16  Anatomy of a proposal                                           [HERO — decision detail, annotated]
17  Approve at a glance, or redirect the agent                      [actions detail]
18  The proposal, two ways                                          [VARIATION — full vs quick decision]
19  A session that never fully blocks                               [the loop / dual-lane timeline]
20  Waypoint — start parking decisions instead of waiting on them   [close + CTA]

## Story check (titles only):
Agents run long → one question stalls everything → coming back is costly → put a plane between
you and the agent → it does two things → here's the map (track work) → here's the inbox (decisions)
→ here's how a proposal looks & how you act → it all forms a loop where work never fully blocks → start.
Reads as a coherent arc. ✓

## Decision/proposal anatomy (must appear on detail slide)
question/what's blocked · context (why it came up) · options w/ tradeoffs · agent recommendation
· impact if deferred · reversibility/risk level · approve / pick-option · comment & redirect.
