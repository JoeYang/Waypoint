# Home needs-you command bar

## Why

The cross-project home/re-entry landing (`Home.tsx`) opens on a "Good morning" briefing banner and a
4-tile stat grid (Decisions waiting / Agents working / Tasks in flight / Active streams), then a
grid of project cards. The design review found the hierarchy inverted: the four metrics compete for
attention equally, the actual parked decisions — the only thing that needs the human — are buried
inside per-project cards, and the cards spend their space on multiple per-stream progress bars
rather than telling the human _where each agent is right now_.

This slice (S6) reworks the landing to spend hierarchy on what is waiting. It surfaces the **actual**
parked decisions across all projects at the top with a Review action, emphasises a single "N waiting
on you" count while demoting the other metrics to a quiet inline strip, and reworks each project card
to show where its agent is now plus a parked accent and one segmented progress meter.

## What Changes

Web-only. **No MCP-tool contract change, no REST DTO change, no DB schema change** — this re-reads
the existing `ProjectsData` snapshot (projects, their decisions, streams, tasks) through the existing
`useWaypoint` seam and the existing `navigate` / `openDecision` actions.

- **Needs-you command bar** replaces the 4-tile stat grid at the top of `Home`: one large emphasised
  numeral "{totalOpenDecisions} waiting on you" beside the greeting, then a list of the _actual_
  parked decisions across all projects (collected as `projects.flatMap(p => p.decisions.map(d => ({d,
project: p})))`, filtered to unresolved). Each row shows the decision title/question, its project
  name, "parked {decision.parked}", and a "Review →" button that calls `navigate({ project: p.id })`
  + `openDecision(d.id)` (the latter opens the proposal view for that decision). When there are no
  open decisions the bar shows an "all caught up" state.
- **Demoted metrics strip** — the other metrics (agents working, tasks in flight, active streams)
  collapse into a single quiet inline strip ("3 projects · 2 agents working · 9 tasks in flight · 5
  active streams"), present but not competing. Counts derive from the data: agents working =
  projects with `agent === "working"`; tasks in flight = `active` tasks across all streams; active
  streams = streams with `status === "active"`.
- **Project cards** gain a live "Now — {activeTaskName}" line (the project's current task: the task
  with `here === true`, else the first `status === "active"` task; omitted when none), an amber
  left-edge accent on cards with ≥1 open (parked) decision, and a single segmented progress meter per
  card (segments done / active / parked computed from the project's tasks across all streams) with a
  small "X / Y" label, replacing the multiple per-stream bars. The glyph, name, agent pill, and the
  decision/caught-up badge stay.

## Impact

- **No ask-first gate:** no MCP contract, no DB schema, no new dependency.
- Changed: `packages/web/src/components/Home.tsx`, `Home.module.css`, `Home.test.tsx`. Reuses
  `useWaypoint` (`data`, `navigate`, `openDecision`, `resolved`), the `Badge` / `AgentPill`
  components, and the axiom tokens.
