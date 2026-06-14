import type { InboxItem, InboxResponse, WsServerFrame } from "@waypoint/shared";

// The client-side projection of the live inbox. Pure and transport-free (the WebSocket
// plumbing lives in useWaypointStream) so the delta/idempotency/resync logic is unit-tested
// without a socket — mirroring the server's InboxHub, which it must agree with.
export interface InboxState {
  itemsById: Record<string, InboxItem>;
  seq: number;
}

// seq starts below 0 so the first frame — including an empty project's seq-0 snapshot —
// always applies.
export const initialInboxState: InboxState = { itemsById: {}, seq: -1 };

// Fold one server frame into the state. Idempotent: a frame whose seq is not newer than
// what we have applied is ignored, so replaying or receiving a duplicate is a no-op. A
// resync resets to empty — the hook then reconnects for a fresh snapshot (WsResync carries
// no seq, so local state cannot be trusted and is cleared).
export function applyFrame(state: InboxState, frame: WsServerFrame): InboxState {
  if (frame.type === "resync") return initialInboxState;
  if (frame.seq <= state.seq) return state;

  const itemsById = { ...state.itemsById };
  for (const upsert of frame.upserts) itemsById[upsert.askId] = upsert;
  for (const removedId of frame.removedAskIds) delete itemsById[removedId];
  return { itemsById, seq: frame.seq };
}

// Seed state from a REST inbox snapshot (the deterministic first-paint path that races the
// WebSocket connect). Modelled as a delta so the same seq-guard keeps it consistent with
// any WebSocket frames that arrive first.
export function applySnapshot(state: InboxState, response: InboxResponse): InboxState {
  return applyFrame(state, {
    type: "delta",
    seq: response.seq,
    upserts: response.items,
    removedAskIds: [],
  });
}

// The ranked queue the UI renders: most-blocking first, ties broken by longest wait. Agrees
// with core.listInbox so the WS-driven order matches the server's.
export function rankInbox(state: InboxState): InboxItem[] {
  return Object.values(state.itemsById).sort(
    (a, b) => b.blastRadius - a.blastRadius || a.parkedAt - b.parkedAt,
  );
}
