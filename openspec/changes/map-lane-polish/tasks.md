# Tasks

## 1. web — component (TDD red→green)

- [ ] 1.1 Tests first (`ProjectMap.test.tsx`): the summary strip shows the stream count + parked
      count; a lane header exposes a `progressbar` with the right `aria-valuenow`; a collapsed done
      lane shows the "all green" summary; the "Jump to where you left off" button exists and
      clicking it expands the `here` task's lane. Keep existing `ProjectMap`/`TaskNode` tests green.
- [ ] 1.2 `useLaneExpansion` gains `expand(id)` (force a lane open regardless of default/toggle).
- [ ] 1.3 `ProjectMap.tsx`: lane-header meter (`role="progressbar"` + aria), collapsed-done inline
      summary, the summary strip (streams / live edits / parked) + "Jump to where you left off"
      button (find `here`, expand its lane, scroll into view — guarded for jsdom).
- [ ] 1.4 `TaskNode.tsx`: optional `id` prop threaded onto the row (the scroll target); default
      behaviour unchanged.
- [ ] 1.5 `ProjectMap.module.css`: meter bar + fill (CSS-var width), summary-strip layout, the
      collapsed-done summary line.

## Follow-ups

- [ ] (none) — this completes the S4 map uplift.
