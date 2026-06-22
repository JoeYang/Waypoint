// The shared re-entry data hook. Each re-entry surface (Briefing now; Mission/Timeline next)
// reads through this hook rather than touching the source or the digest/story shapes directly,
// so the surfaces stay thin and consistent. It fetches the enriched digest + the project story
// on mount and folds them — together with the project's open decisions and the signed-in user —
// into one surface-ready `ReentryModel`, exposing a discriminated loading / error / ready state.
//
// `isNew` on a needs-you decision is taken from the matching waiting digest entry (by ask id):
// the digest is the cursor-aware source of "new since you left", so the surface never re-derives
// it. The fetch handles both rejection paths (digest or story) into the error state with a retry.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Digest, DigestActiveWork, DigestHeadsUp, DigestNode } from "@waypoint/shared";
import { useWaypoint } from "./WaypointProvider.js";
import type { Decision } from "./types.js";

export interface ReentryGreeting {
  projectName: string;
  userName: string;
}

// The surface-ready view-model. Surfaces render this directly; they do not see the raw digest.
export interface ReentryModel {
  greeting: ReentryGreeting;
  needsYou: Decision[]; // the project's open decisions, isNew flagged from the digest
  activeWork: DigestActiveWork[];
  moved: DigestNode[]; // what shipped
  headsUp: DigestHeadsUp[];
  tallies: Digest["tallies"];
  seq: number; // the digest seq, for acknowledging the read cursor
}

export type ReentryState =
  | { status: "loading" }
  | { status: "error"; retry: () => void }
  | { status: "ready"; model: ReentryModel };

// Fold the project's open decisions with the digest's waiting rows: a decision is "new" exactly
// when a waiting entry with the same ask id is itself new (cursor-derived in the digest).
function mapNeedsYou(decisions: readonly Decision[], digest: Digest): Decision[] {
  const newAskIds = new Set(digest.waiting.filter((w) => w.isNew).map((w) => w.askId));
  return decisions.map((d) => (newAskIds.has(d.id) ? { ...d, isNew: true } : d));
}

export function useReentry(projectId: string): ReentryState {
  const { data, digest, story } = useWaypoint();
  const [digestData, setDigestData] = useState<Digest | null>(null);
  const [errored, setErrored] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setDigestData(null);
    setErrored(false);
    let active = true;
    // Both fetches must succeed; either rejection lands the error state. The story is fetched
    // (the surfaces will thread it) but the model below reads only the digest + project today.
    Promise.all([digest(projectId), story(projectId)]).then(
      ([d]) => {
        if (active) setDigestData(d);
      },
      () => {
        if (active) setErrored(true);
      },
    );
    return () => {
      active = false;
    };
  }, [projectId, digest, story, reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  const project = data.projects.find((p) => p.id === projectId);

  const model = useMemo<ReentryModel | null>(() => {
    if (digestData === null || project === undefined) return null;
    return {
      greeting: { projectName: project.name, userName: data.user.name },
      needsYou: mapNeedsYou(project.decisions, digestData),
      activeWork: digestData.activeWork,
      moved: digestData.shipped,
      headsUp: digestData.headsUp,
      tallies: digestData.tallies,
      seq: digestData.seq,
    };
  }, [digestData, project, data.user.name]);

  if (errored) return { status: "error", retry };
  if (model === null) return { status: "loading" };
  return { status: "ready", model };
}
