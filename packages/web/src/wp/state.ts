// Navigation + local decision state for the storybook UI, modelled as a pure reducer so it is
// testable without React. Mirrors the handoff App()'s nav/resolved/threads state and its
// resolve→resume and comment→reply interactions.

import type { Message, ProjectsData } from "./types.js";

export type View = "home" | "map" | "inbox" | "proposal" | "activity" | "settings";

const VIEWS: readonly View[] = ["home", "map", "inbox", "proposal", "activity", "settings"];

export interface Nav {
  project: string | null;
  view: View;
  decision: string | null;
}

export interface WaypointState {
  nav: Nav;
  resolved: Record<string, { option: string }>;
  threads: Record<string, Message[]>;
}

export const HOME_NAV: Nav = { project: null, view: "home", decision: null };

export const initialState = (nav: Nav = HOME_NAV): WaypointState => ({
  nav,
  resolved: {},
  threads: {},
});

export type Action =
  | { type: "navigate"; to: { project?: string | null; view?: View; decision?: string | null } }
  | { type: "goHome" }
  | { type: "openDecision"; id: string }
  | { type: "resolve"; id: string; option: string; blocksTask: string }
  | { type: "comment"; id: string; text: string }
  // Drop optimistic resolved/thread entries whose decision no longer exists in live data (it was
  // answered, here or by another agent, and the reload removed it) — keeps the maps from drifting.
  | { type: "prune"; validIds: readonly string[] };

// The agent's resume message when a decision is approved (matches the handoff copy).
export const resolveMessage = (option: string, blocksTask: string): Message => ({
  who: "agent",
  t: "now",
  text: `Applied ${option}. Resuming “${blocksTask}” now — I'll pick the rest of the stream back up behind it.`,
});

export const youMessage = (text: string): Message => ({ who: "you", t: "now", text });

export const agentReply = (): Message => ({
  who: "agent",
  t: "now",
  text: "Noted — I'll factor that in. Approve an option above whenever you're ready and I'll apply it with that constraint.",
});

export function reducer(state: WaypointState, action: Action): WaypointState {
  switch (action.type) {
    case "navigate":
      return {
        ...state,
        nav: {
          project: action.to.project ?? null,
          view: action.to.view ?? "map",
          decision: action.to.decision ?? null,
        },
      };
    case "goHome":
      return { ...state, nav: HOME_NAV };
    case "openDecision":
      return { ...state, nav: { ...state.nav, view: "proposal", decision: action.id } };
    case "resolve": {
      if (state.resolved[action.id]) return state; // already resolved → no-op
      const prior = state.threads[action.id] ?? [];
      return {
        ...state,
        resolved: { ...state.resolved, [action.id]: { option: action.option } },
        threads: {
          ...state.threads,
          [action.id]: [...prior, resolveMessage(action.option, action.blocksTask)],
        },
      };
    }
    case "comment": {
      const prior = state.threads[action.id] ?? [];
      return {
        ...state,
        threads: {
          ...state.threads,
          [action.id]: [...prior, youMessage(action.text), agentReply()],
        },
      };
    }
    case "prune": {
      const valid = new Set(action.validIds);
      const keep = <T>(map: Record<string, T>): Record<string, T> =>
        Object.fromEntries(Object.entries(map).filter(([id]) => valid.has(id)));
      const resolved = keep(state.resolved);
      const threads = keep(state.threads);
      // Preserve referential identity when nothing changed (avoids a needless re-render).
      const sameSize =
        Object.keys(resolved).length === Object.keys(state.resolved).length &&
        Object.keys(threads).length === Object.keys(state.threads).length;
      return sameSize ? state : { ...state, resolved, threads };
    }
    default:
      return assertNever(action);
  }
}

function assertNever(action: never): never {
  throw new Error(`unhandled action: ${JSON.stringify(action)}`);
}

const isView = (v: unknown): v is View =>
  typeof v === "string" && (VIEWS as readonly string[]).includes(v);

const isNav = (v: unknown): v is Nav => {
  if (typeof v !== "object" || v === null) return false;
  const n = v as Record<string, unknown>;
  return (
    (n["project"] === null || typeof n["project"] === "string") &&
    isView(n["view"]) &&
    (n["decision"] === null || typeof n["decision"] === "string")
  );
};

export const NAV_KEY = "wp_nav_v1";

// Load nav from storage; any corruption (unparseable, wrong shape, throwing storage) → HOME_NAV.
export function loadNav(storage: Pick<Storage, "getItem"> | undefined): Nav {
  try {
    const raw = storage?.getItem(NAV_KEY);
    if (!raw) return HOME_NAV;
    const parsed: unknown = JSON.parse(raw);
    return isNav(parsed) ? parsed : HOME_NAV;
  } catch {
    return HOME_NAV;
  }
}

export function saveNav(storage: Pick<Storage, "setItem"> | undefined, nav: Nav): void {
  try {
    storage?.setItem(NAV_KEY, JSON.stringify(nav));
  } catch {
    // storage unavailable (private mode, quota) — navigation just won't persist.
  }
}

// Correct a nav that points at data which no longer exists, so the UI never renders a blank
// screen: unknown project → home; a proposal whose decision is missing → the project's inbox.
export function safeNav(nav: Nav, data: ProjectsData): Nav {
  if (nav.project === null) return HOME_NAV; // no project selected → the cross-project home
  const project = data.projects.find((p) => p.id === nav.project);
  if (!project) return HOME_NAV;
  if (nav.view === "proposal") {
    const exists = nav.decision !== null && project.decisions.some((d) => d.id === nav.decision);
    if (!exists) return { project: nav.project, view: "inbox", decision: null };
  }
  return nav;
}
