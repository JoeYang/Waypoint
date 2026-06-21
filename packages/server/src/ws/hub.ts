import type { Core } from "@waypoint/core";
import type { InboxItem, WsDelta, WsServerFrame } from "@waypoint/shared";

export type Send = (frame: WsServerFrame) => void;

export interface Subscription {
  close(): void;
}

interface ProjectState {
  current: { seq: number; items: InboxItem[] } | null;
  ring: Map<number, InboxItem[]>; // seq → inbox snapshot, bounded by `retain`
  subscribers: Set<Send>;
}

const RETAIN_DEFAULT = 256;

// In-process projection of the live inbox. It holds no domain logic: it recomputes the
// ranked inbox from core after each committed mutation, diffs it against the previous
// snapshot, and pushes the change to subscribers. Bounded snapshot history lets a
// reconnecting client resume from its last seq; older-than-retained falls back to resync.
export class InboxHub {
  private readonly states = new Map<string, ProjectState>();
  private readonly retain: number;

  constructor(
    private readonly core: Pick<Core, "listInbox">,
    opts?: { retain?: number },
  ) {
    this.retain = Math.max(1, opts?.retain ?? RETAIN_DEFAULT);
  }

  private stateFor(projectId: string): ProjectState {
    const existing = this.states.get(projectId);
    if (existing) return existing;
    const fresh: ProjectState = { current: null, ring: new Map(), subscribers: new Set() };
    this.states.set(projectId, fresh);
    return fresh;
  }

  private store(state: ProjectState, seq: number, items: InboxItem[]): void {
    state.ring.set(seq, items);
    while (state.ring.size > this.retain) {
      const oldest = Math.min(...state.ring.keys());
      state.ring.delete(oldest);
    }
  }

  private async refresh(
    projectId: string,
    state: ProjectState,
  ): Promise<{ seq: number; items: InboxItem[] }> {
    const snapshot = await this.core.listInbox(projectId);
    const current = { seq: snapshot.seq, items: snapshot.items };
    state.current = current;
    this.store(state, current.seq, current.items);
    return current;
  }

  // Push an arbitrary server frame (e.g. a tiered-notification `digest.ready`) to every live
  // subscriber of a project, without recomputing the inbox. A no-op when no one is subscribed —
  // the durable digest-on-return still covers a human with no open tab. Holds no domain logic;
  // the notifier decides whether to call this.
  broadcast(projectId: string, frame: WsServerFrame): void {
    const state = this.states.get(projectId);
    if (!state) return;
    for (const send of state.subscribers) send(frame);
  }

  // Recompute the inbox after a committed mutation and broadcast the resulting delta to
  // every live subscriber. Returns the delta (for tests / callers that want it).
  async notify(projectId: string): Promise<WsDelta> {
    const state = this.stateFor(projectId);
    const previous = state.current?.items ?? [];
    const next = await this.refresh(projectId, state);
    const delta = diff(previous, next.items, next.seq);
    for (const send of state.subscribers) send(delta);
    return delta;
  }

  // Register a subscriber and send its initial frame: a full snapshot when resuming from
  // null, a forward-only diff from the nearest retained baseline, or a resync request when
  // the client's lastSeq predates retained history.
  async subscribe(projectId: string, lastSeq: number | null, send: Send): Promise<Subscription> {
    const state = this.stateFor(projectId);
    const current = state.current ?? (await this.refresh(projectId, state));
    state.subscribers.add(send);

    if (lastSeq === null) {
      send({ type: "delta", seq: current.seq, upserts: current.items, removedAskIds: [] });
    } else {
      const baselineSeq = [...state.ring.keys()]
        .filter((seq) => seq <= lastSeq)
        .sort((a, b) => b - a)[0];
      const baseline = baselineSeq === undefined ? undefined : state.ring.get(baselineSeq);
      if (!baseline) {
        send({ type: "resync", reason: "lastSeq predates retained history" });
      } else {
        send(diff(baseline, current.items, current.seq));
      }
    }

    return {
      close: () => {
        state.subscribers.delete(send);
      },
    };
  }
}

// Projection diff: a card is upserted if it is new or its content changed; a card is
// removed if it left the queue. Equality is by stable JSON (listInbox emits fields in a
// fixed order), so applying the same delta twice is a no-op on the client.
function diff(previous: InboxItem[], next: InboxItem[], seq: number): WsDelta {
  const previousJson = new Map(previous.map((item) => [item.askId, JSON.stringify(item)]));
  const nextIds = new Set(next.map((item) => item.askId));
  const upserts = next.filter((item) => previousJson.get(item.askId) !== JSON.stringify(item));
  const removedAskIds = previous
    .filter((item) => !nextIds.has(item.askId))
    .map((item) => item.askId);
  return { type: "delta", seq, upserts, removedAskIds };
}
