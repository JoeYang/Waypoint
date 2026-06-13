---
paths: ["packages/web/src/**"]
---
# Frontend Rules (React/Vite)

## Components
- Functional components only — no class components.
- Local state via hooks; a small store only for truly shared state (the live inbox + WS connection).
- Memoize expensive derivations (`useMemo`/`useCallback`); component over ~150 lines → extract a hook.
- `PascalCase` components, `camelCase` hooks/utils.
- Two screens are the app: `InboxScreen` and `BlockingScreen`. The "blocks N" badge links inbox → blocking view.

## Async & live state
- Every async/live view handles three states: loading, error, and empty/success — never a blank screen.
- Error states include a recovery action (retry, reconnect).
- The WebSocket hook (`useWaypointStream`) handles reconnect and resume-since-seq; the UI re-ranks the inbox on a delta, it does not poll.
- The signature interaction (answer → card flips to "working" → next rises) is driven by WS deltas, not optimistic-only updates.

## Accessibility & styling
- Semantic HTML first; ARIA labels on icon-only controls; full keyboard operability; WCAG AA contrast.
- CSS modules or Tailwind — no global stylesheets; mobile-first responsive; no inline styles except dynamic values.

## Testing
- Test rendering and user interaction, not implementation. `getByRole`/`getByLabelText` over `getByTestId`. Mock the wire (`msw`), not internal functions.
