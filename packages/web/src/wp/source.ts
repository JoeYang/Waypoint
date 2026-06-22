// The data seam. Screens read through a WaypointSource, never from fixtures or a network
// client directly — so the source can be swapped (mock → live backend) without touching any
// screen (design spec §4).
//
// The seam is async to admit a live backend, with a synchronous `initial()` seed: the mock
// returns its fixtures immediately (no loading flash, and synchronous tests stay green), while
// the live source returns null so the provider shows a loading state until `load()` resolves.
// `subscribe` lets a live source push (the WS delta) a re-load; the mock never fires it.

import type { Digest, StoryResponse } from "@waypoint/shared";
import { WP_DATA } from "./fixtures.js";
import type { ProjectsData } from "./types.js";

// A human's answer to a parked decision, assembled by the provider from the view-model and sent
// to the backend by the live source (the mock no-ops; its optimistic local state stands).
export interface AnswerCommand {
  projectId: string;
  decisionId: string; // the ask id
  chosenOptionId?: string; // for a DECISION
  adjustmentNote?: string; // for a PROPOSAL "adjust" verdict
  expectedVersion: number; // optimistic-concurrency guard
}

export interface WaypointSource {
  /** Synchronous first-paint snapshot, or null when only async data is available. */
  initial(): ProjectsData | null;
  /** Fetch (or refresh) the full world snapshot. */
  load(): Promise<ProjectsData>;
  /** Subscribe to live changes; the callback asks the provider to re-load. Returns an unsubscribe. */
  subscribe(onChange: () => void): () => void;
  /** Persist a human's answer. Rejects (e.g. a stale version) so the provider can reconcile. */
  answer(command: AnswerCommand): Promise<void>;
  /** The while-you-were-away digest for a project (re-entry, slice 3). */
  digest(projectId: string): Promise<Digest>;
  /** Acknowledge the digest up to `seq` (advance the read cursor). */
  ackDigest(projectId: string, seq: number): Promise<void>;
  /** The threaded project story (the event log read back as narrative). */
  story(projectId: string): Promise<StoryResponse>;
}

// A small, believable digest/story so the mock UI exercises the re-entry surfaces with no backend.
const MOCK_DIGEST: Digest = {
  projectId: "orbit-api",
  sinceSeq: 0,
  seq: 3,
  shipped: [{ nodeId: "n-ship", kind: "task", title: "Wire the spine to live data" }],
  newlyBlocked: [{ nodeId: "n-block", kind: "task", title: "Choose the cache strategy" }],
  waiting: [
    {
      askId: "d-cache",
      nodeId: "n-block",
      nodeTitle: "Choose the cache strategy",
      type: "DECISION",
      prompt: "Redis or in-process?",
      blastRadius: 4,
      ageMs: 3 * 60 * 60 * 1000,
      risk: "high",
      reversible: false,
      isNew: true,
    },
  ],
  activeWork: [
    {
      nodeId: "n-seed",
      nodeTitle: "Seed scripts",
      kind: "task",
      streamId: "n-data",
      streamTitle: "Data layer",
    },
  ],
  headsUp: [
    {
      askId: "d-cache",
      nodeId: "n-block",
      nodeTitle: "Choose the cache strategy",
      prompt: "Redis or in-process?",
      risk: "high",
      reversible: false,
      kind: "danger",
    },
  ],
  tallies: { done: 4, active: 2, parked: 1, queued: 6 },
};

const MOCK_STORY: StoryResponse = {
  projectId: "orbit-api",
  seq: 3,
  entries: [
    {
      seq: 1,
      at: 1700000000000,
      actor: "agent",
      actorLabel: "brave-lark",
      verb: "node.transitioned",
      nodeId: "n-ship",
      nodeTitle: "Wire the spine to live data",
      summary: "moved to DONE",
    },
    {
      seq: 2,
      at: 1700000600000,
      actor: "agent",
      actorLabel: "brave-lark",
      verb: "ask.parked",
      nodeId: "n-block",
      nodeTitle: "Choose the cache strategy",
      summary: "parked a decision",
    },
  ],
};

export const mockSource: WaypointSource = {
  initial: () => WP_DATA,
  load: () => Promise.resolve(WP_DATA),
  subscribe: () => () => {},
  answer: () => Promise.resolve(), // the mock's optimistic local reducer state is the source of truth
  digest: () => Promise.resolve(MOCK_DIGEST),
  ackDigest: () => Promise.resolve(),
  story: () => Promise.resolve(MOCK_STORY),
};
