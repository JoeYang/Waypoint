// React context that wires the data source to the nav/decision reducer and persists nav to
// localStorage. Screens consume `useWaypoint()` for the data snapshot, the current nav, and
// the bound actions; they never import the source or reducer directly.
//
// The source is async (it may be the live backend): the outer component owns loading / error /
// empty states and only renders the inner provider — and any screen — once data is present, so
// `useWaypoint().data` is never null and `safeNav` never runs against missing data.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import type { JSX, ReactNode } from "react";
import { mockSource, type WaypointSource } from "./source.js";
import { initialState, loadNav, reducer, saveNav, safeNav, type Nav, type View } from "./state.js";
import type { Decision, ProjectsData, Message } from "./types.js";
import s from "./provider-states.module.css";

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

const findDecision = (
  data: ProjectsData,
  id: string,
): { decision: Decision; projectId: string } | undefined => {
  for (const p of data.projects) {
    const d = p.decisions.find((x) => x.id === id);
    if (d) return { decision: d, projectId: p.id };
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
  const [data, setData] = useState<ProjectsData | null>(() => source.initial());
  const [errored, setErrored] = useState(false);

  const reload = useCallback(() => {
    setErrored(false);
    source.load().then(setData, () => setErrored(true));
  }, [source]);

  useEffect(() => {
    reload();
    return source.subscribe(reload); // live deltas ask for a re-load; the mock never fires
  }, [reload, source]);

  if (data === null) {
    return errored ? (
      <div className={s.center} role="alert">
        <div className={s.title}>Couldn&apos;t reach Waypoint</div>
        <button type="button" className={s.retry} onClick={reload}>
          Try again
        </button>
      </div>
    ) : (
      <div className={s.center} role="status" aria-live="polite">
        Loading…
      </div>
    );
  }

  if (data.projects.length === 0) {
    return (
      <div className={s.center}>
        <div className={s.title}>No projects yet</div>
        <p>Connect an agent and park a decision to see it here.</p>
      </div>
    );
  }

  return (
    <ReadyProvider data={data} storage={storage} source={source} reload={reload}>
      {children}
    </ReadyProvider>
  );
}

function ReadyProvider({
  data,
  storage,
  source,
  reload,
  children,
}: {
  data: ProjectsData;
  storage: Pick<Storage, "getItem" | "setItem"> | undefined;
  source: WaypointSource;
  reload: () => void;
  children: ReactNode;
}): JSX.Element {
  const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);
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
        const found = findDecision(data, id);
        if (!found) return; // unknown id → no-op, never throws
        // Optimistic: flip the UI immediately, then persist. The backend answer drives a reload
        // (the card leaves on live data); a rejection (e.g. STALE_VERSION) reconciles via the
        // same reload. The mock answer is a no-op, so its optimistic state simply stands.
        dispatch({ type: "resolve", id, option, blocksTask: found.decision.blocksTask });
        const chosenOptionId = found.decision.options.find((o) => o.name === option)?.id;
        void source
          .answer({
            projectId: found.projectId,
            decisionId: id,
            ...(chosenOptionId !== undefined ? { chosenOptionId } : {}),
            expectedVersion: found.decision.version ?? 0,
          })
          .then(reload, reload);
      },
      comment: (id, text) => dispatch({ type: "comment", id, text }),
    };
  }, [data, state.nav, state.resolved, state.threads, source, reload]);

  return <WaypointContext.Provider value={value}>{children}</WaypointContext.Provider>;
}

export function useWaypoint(): WaypointContextValue {
  const ctx = useContext(WaypointContext);
  if (ctx === null) {
    throw new Error("useWaypoint must be used within a WaypointProvider");
  }
  return ctx;
}
