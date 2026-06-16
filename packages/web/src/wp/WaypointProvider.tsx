// React context that wires the data source to the nav/decision reducer and persists nav to
// localStorage. Screens consume `useWaypoint()` for the data snapshot, the current nav, and
// the bound actions; they never import the source or reducer directly.

import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { JSX, ReactNode } from "react";
import { mockSource, type WaypointSource } from "./source.js";
import { initialState, loadNav, reducer, saveNav, safeNav, type Nav, type View } from "./state.js";
import type { Decision, ProjectsData, Message } from "./types.js";

export interface WaypointContextValue {
  data: ProjectsData;
  nav: Nav; // already corrected by safeNav — always points at data that exists
  resolved: Record<string, { option: string }>;
  threads: Record<string, Message[]>;
  navigate: (to: { project?: string | null; view?: View; decision?: string | null }) => void;
  goHome: () => void;
  openDecision: (id: string) => void;
  resolve: (id: string, option: string) => void;
  comment: (id: string, text: string) => void;
}

const WaypointContext = createContext<WaypointContextValue | null>(null);

const findDecision = (data: ProjectsData, id: string): Decision | undefined => {
  for (const p of data.projects) {
    const d = p.decisions.find((x) => x.id === id);
    if (d) return d;
  }
  return undefined;
};

export interface WaypointProviderProps {
  children: ReactNode;
  source?: WaypointSource;
  /** Storage for nav persistence; defaults to window.localStorage, overridable in tests. */
  storage?: Pick<Storage, "getItem" | "setItem">;
}

export function WaypointProvider({
  children,
  source = mockSource,
  storage,
}: WaypointProviderProps): JSX.Element {
  const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);
  const data = source.getData();
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState(loadNav(store)));

  useEffect(() => {
    saveNav(store, state.nav);
  }, [store, state.nav]);

  const value = useMemo<WaypointContextValue>(() => {
    return {
      data,
      nav: safeNav(state.nav, data),
      resolved: state.resolved,
      threads: state.threads,
      navigate: (to) => dispatch({ type: "navigate", to }),
      goHome: () => dispatch({ type: "goHome" }),
      openDecision: (id) => dispatch({ type: "openDecision", id }),
      resolve: (id, option) => {
        const decision = findDecision(data, id);
        if (!decision) return; // unknown id → no-op, never throws
        dispatch({ type: "resolve", id, option, blocksTask: decision.blocksTask });
      },
      comment: (id, text) => dispatch({ type: "comment", id, text }),
    };
  }, [data, state.nav, state.resolved, state.threads]);

  return <WaypointContext.Provider value={value}>{children}</WaypointContext.Provider>;
}

export function useWaypoint(): WaypointContextValue {
  const ctx = useContext(WaypointContext);
  if (ctx === null) {
    throw new Error("useWaypoint must be used within a WaypointProvider");
  }
  return ctx;
}
