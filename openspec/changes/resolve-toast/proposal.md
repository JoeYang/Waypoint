# Resolve confirmation toast

## Why

When a human answers a parked decision — approving the recommendation, applying another option, or
sending a redirecting constraint — the UI flips the card to a resolved state, but nothing
*confirms the action landed*. UI Review item 12 calls this out: the loop closes silently. A human
who clicks "Approve" and immediately looks away has no reassurance that the agent is resuming. A
lightweight, transient toast closes the loop without stealing focus.

## What Changes

A small, dependency-free **toast system** in `packages/web`, and a wiring of it into the two resolve
surfaces:

- A `ToastProvider` exposing `useToast() → { toast(message) }`. It holds a queue of messages, each
  with an id, and renders a fixed-position live region (`role="status" aria-live="polite"`) listing
  active toasts. Each toast auto-dismisses after ~4s and carries a manual dismiss button.
- `Proposal` and `DecisionCard`, after invoking the existing `resolve` / `adjust` provider actions,
  enqueue a confirmation toast — `Applied <option> — agent resuming` on a resolve, and
  `Sent your adjustment — agent resuming` on the constraint (Send & apply) path.

The resolve/adjust semantics are unchanged — the toast is enqueued *alongside* the existing call.
**Web-only: no MCP-contract or DB-schema change.** `useToast` outside a provider falls back to a
no-op so existing component tests (which render without the provider) stay green, while a dedicated
test asserts the hook contract directly.

## Impact

- `packages/web` only: new `components/ToastProvider.{tsx,module.css}`, mounted wrapping the app
  tree; `toast(...)` calls added in `Proposal` and `DecisionCard`. Reuses the Axiom tokens.
- No changes to `shared`, `core`, or `server`; no contract or schema change.
