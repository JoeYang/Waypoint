// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { WaypointProvider, useWaypoint } from "./WaypointProvider.js";
import { NAV_KEY } from "./state.js";
import { WP_DATA } from "./fixtures.js";
import type { WaypointSource } from "./source.js";

afterEach(cleanup);

// A probe component that surfaces context state and exposes the actions as buttons.
function Probe(): React.JSX.Element {
  const wp = useWaypoint();
  return (
    <div>
      <span data-testid="view">{wp.nav.view}</span>
      <span data-testid="project">{wp.nav.project ?? "none"}</span>
      <span data-testid="decision">{wp.nav.decision ?? "none"}</span>
      <span data-testid="resolved">{wp.resolved["d1"]?.option ?? "no"}</span>
      <span data-testid="thread">{(wp.threads["d1"] ?? []).map((m) => m.who).join(",")}</span>
      <button onClick={() => wp.navigate({ project: "orbit-api", view: "inbox" })}>nav</button>
      <button onClick={() => wp.openDecision("d1")}>open</button>
      <button onClick={() => wp.resolve("d1", "Drizzle")}>resolve</button>
      <button onClick={() => wp.comment("d1", "hi")}>comment</button>
      <button onClick={() => wp.adjust("d1", "keep the poller 30d")}>adjust</button>
      <button onClick={() => wp.goHome()}>home</button>
    </div>
  );
}

const click = (name: string) => act(() => screen.getByRole("button", { name }).click());

describe("WaypointProvider", () => {
  beforeEach(() => localStorage.clear());

  it("starts at home with no project", () => {
    render(
      <WaypointProvider>
        <Probe />
      </WaypointProvider>,
    );
    expect(screen.getByTestId("view")).toHaveTextContent("home");
    expect(screen.getByTestId("project")).toHaveTextContent("none");
  });

  it("navigates and opens a decision through the bound actions", () => {
    render(
      <WaypointProvider>
        <Probe />
      </WaypointProvider>,
    );
    click("nav");
    expect(screen.getByTestId("view")).toHaveTextContent("inbox");
    click("open");
    expect(screen.getByTestId("view")).toHaveTextContent("proposal");
    expect(screen.getByTestId("decision")).toHaveTextContent("d1");
  });

  it("resolve looks up blocksTask from data and threads the agent message", () => {
    render(
      <WaypointProvider>
        <Probe />
      </WaypointProvider>,
    );
    click("resolve");
    expect(screen.getByTestId("resolved")).toHaveTextContent("Drizzle");
    expect(screen.getByTestId("thread")).toHaveTextContent("agent");
  });

  it("comment threads you then agent", () => {
    render(
      <WaypointProvider>
        <Probe />
      </WaypointProvider>,
    );
    click("comment");
    expect(screen.getByTestId("thread")).toHaveTextContent("you,agent");
  });

  it("persists nav to localStorage and restores it on remount", () => {
    const { unmount } = render(
      <WaypointProvider>
        <Probe />
      </WaypointProvider>,
    );
    click("nav");
    expect(JSON.parse(localStorage.getItem(NAV_KEY) as string)).toMatchObject({
      project: "orbit-api",
      view: "inbox",
    });
    unmount();
    render(
      <WaypointProvider>
        <Probe />
      </WaypointProvider>,
    );
    expect(screen.getByTestId("view")).toHaveTextContent("inbox");
    expect(screen.getByTestId("project")).toHaveTextContent("orbit-api");
  });

  it("starts at home when stored nav is corrupt", () => {
    localStorage.setItem(NAV_KEY, "{garbage");
    render(
      <WaypointProvider>
        <Probe />
      </WaypointProvider>,
    );
    expect(screen.getByTestId("view")).toHaveTextContent("home");
  });

  it("useWaypoint throws outside a provider", () => {
    const Bare = () => {
      useWaypoint();
      return null;
    };
    // Silence React's error boundary console noise for the expected throw.
    expect(() => render(<Bare />)).toThrow(/within a WaypointProvider/);
  });
});

function CountProbe(): React.JSX.Element {
  const { data } = useWaypoint();
  return <span data-testid="projects">{data.projects.length}</span>;
}

describe("WaypointProvider async states", () => {
  beforeEach(() => localStorage.clear());

  it("shows the loading state while an async load is in flight (no sync seed)", () => {
    const pending: WaypointSource = {
      initial: () => null,
      load: () => new Promise(() => {}), // never resolves
      subscribe: () => () => {},
      answer: () => Promise.resolve(),
    };
    render(
      <WaypointProvider source={pending}>
        <CountProbe />
      </WaypointProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/Loading/i);
    expect(screen.queryByTestId("projects")).not.toBeInTheDocument();
  });

  it("shows the error state with a retry that re-invokes load", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const flaky: WaypointSource = {
      initial: () => null,
      load: () => {
        attempts += 1;
        return attempts === 1 ? Promise.reject(new Error("offline")) : Promise.resolve(WP_DATA);
      },
      subscribe: () => () => {},
      answer: () => Promise.resolve(),
    };
    render(
      <WaypointProvider source={flaky}>
        <CountProbe />
      </WaypointProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/Couldn't reach Waypoint/i);

    await user.click(screen.getByRole("button", { name: /Try again/i }));
    await waitFor(() => expect(screen.getByTestId("projects")).toBeInTheDocument());
    expect(attempts).toBe(2);
  });

  it("shows the empty state when the source has no projects", () => {
    const data = { ...WP_DATA, projects: [] };
    const empty: WaypointSource = {
      initial: () => data,
      load: () => Promise.resolve(data),
      subscribe: () => () => {},
      answer: () => Promise.resolve(),
    };
    render(
      <WaypointProvider source={empty}>
        <CountProbe />
      </WaypointProvider>,
    );
    expect(screen.getByText(/No projects yet/i)).toBeInTheDocument();
    expect(screen.queryByTestId("projects")).not.toBeInTheDocument();
  });

  it("re-loads when the source signals a change", async () => {
    const handlers: Array<() => void> = [];
    let payload = { ...WP_DATA, projects: WP_DATA.projects.slice(0, 1) };
    const live: WaypointSource = {
      initial: () => null,
      load: () => Promise.resolve(payload),
      subscribe: (onChange) => {
        handlers.push(onChange);
        return () => {};
      },
      answer: () => Promise.resolve(),
    };
    render(
      <WaypointProvider source={live}>
        <CountProbe />
      </WaypointProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("projects")).toHaveTextContent("1"));

    payload = { ...WP_DATA };
    act(() => handlers.forEach((h) => h()));
    await waitFor(() =>
      expect(screen.getByTestId("projects")).toHaveTextContent(String(WP_DATA.projects.length)),
    );
  });
});

// A source whose orbit-api d1 carries a backend option id + version, so the provider can build
// a real answer command from the view-model.
function answerableData(): typeof WP_DATA {
  return {
    ...WP_DATA,
    projects: WP_DATA.projects.map((p) =>
      p.id === "orbit-api"
        ? {
            ...p,
            decisions: p.decisions.map((d) =>
              d.id === "d1"
                ? {
                    ...d,
                    version: 3,
                    options: d.options.map((o) =>
                      o.name === "Drizzle" ? { ...o, id: "opt-2" } : o,
                    ),
                  }
                : d,
            ),
          }
        : p,
    ),
  };
}

describe("WaypointProvider answer wiring", () => {
  beforeEach(() => localStorage.clear());

  it("delegates resolve to source.answer with the chosen option id and expected version", async () => {
    const data = answerableData();
    const answer = vi.fn(() => Promise.resolve());
    const source = {
      initial: () => data,
      load: () => Promise.resolve(data),
      subscribe: () => () => {},
      answer,
    };
    render(
      <WaypointProvider source={source}>
        <Probe />
      </WaypointProvider>,
    );
    click("resolve"); // the Probe resolves d1 with "Drizzle"
    await waitFor(() =>
      expect(answer).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "orbit-api",
          decisionId: "d1",
          chosenOptionId: "opt-2",
          expectedVersion: 3,
        }),
      ),
    );
    // Optimistic UI flips immediately, regardless of the async persist.
    expect(screen.getByTestId("resolved")).toHaveTextContent("Drizzle");
  });

  it("adjust sends a PROPOSAL adjustment note to source.answer (and resolves)", async () => {
    const data = answerableData();
    const answer = vi.fn(() => Promise.resolve());
    const source = {
      initial: () => data,
      load: () => Promise.resolve(data),
      subscribe: () => () => {},
      answer,
    };
    render(
      <WaypointProvider source={source}>
        <Probe />
      </WaypointProvider>,
    );
    click("adjust");
    await waitFor(() =>
      expect(answer).toHaveBeenCalledWith(
        expect.objectContaining({
          decisionId: "d1",
          adjustmentNote: "keep the poller 30d",
          expectedVersion: 3,
        }),
      ),
    );
    expect(screen.getByTestId("resolved")).toHaveTextContent("keep the poller 30d");
  });

  it("reloads to reconcile when the answer is rejected (no lost write)", async () => {
    const data = answerableData();
    let loads = 0;
    const source = {
      initial: () => data,
      load: () => {
        loads += 1;
        return Promise.resolve(data);
      },
      subscribe: () => () => {},
      answer: () => Promise.reject(new Error("STALE_VERSION")),
    };
    render(
      <WaypointProvider source={source}>
        <Probe />
      </WaypointProvider>,
    );
    await waitFor(() => expect(loads).toBeGreaterThanOrEqual(1)); // mount load
    const before = loads;
    click("resolve");
    await waitFor(() => expect(loads).toBeGreaterThan(before)); // rejection → reconcile reload
  });
});
