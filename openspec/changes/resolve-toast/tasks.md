# Tasks

## 1. web — toast system (TDD red→green)

- [x] 1.1 `ToastProvider` + `useToast()` hook: a context holding a queue of `{ id, message }`,
      rendering a fixed live region (`role="status" aria-live="polite" aria-label="Notifications"`)
      with a dismiss button per toast and a ref'd ~4s auto-dismiss cleared on unmount. `useToast`
      outside a provider returns a no-op `toast`.
- [x] 1.2 `ToastProvider.module.css` on the Axiom tokens (fixed bottom region, raised surface).
- [x] 1.3 Mount `<ToastProvider>` wrapping the app tree (`main.tsx`).
- [x] 1.4 Tests: `toast(msg)` renders a `role="status"` with the message; advancing fake timers
      past the timeout removes it; the dismiss button removes it; the hook contract (no-op outside
      a provider) holds.

## 2. web — wire the resolve surfaces

- [ ] 2.1 `Proposal`: after `resolve(id, chosenName)`, `toast("Applied <name> — agent resuming")`.
- [ ] 2.2 `DecisionCard`: after `resolve`, the same applied toast; after `adjust` (Send & apply),
      `toast("Sent your adjustment — agent resuming")`.
- [ ] 2.3 Tests: approving in `Proposal` shows the applied toast; the `DecisionCard` Send & apply
      path shows the adjustment toast. Existing Proposal/DecisionCard tests stay green.
