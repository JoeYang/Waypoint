// The live WaypointSource: composes the REST client + the adapter into the same seam the mock
// satisfies, so no screen changes. `load` fans out over the project list (list → progress +
// inbox per project) and maps each via the adapter. `answer` POSTs to the backend with the
// ask's expected version; the provider reloads on success and reconciles on a stale rejection.
//
// Cross-agent live push (a WS-driven re-rank) is a flagged follow-up: this slice refreshes on
// the human's own answer (reload-after-answer), not yet on another agent's parked ask.

import type { ProjectsData, User } from "./types.js";
import type { WaypointSource, AnswerCommand } from "./source.js";
import { toProject, deriveNotifications } from "./adapter.js";
import { fetchProjects, fetchProgress, fetchInbox, fetchEvents, answerAsk } from "../api/client.js";

// No identity until auth lands (D9): a stub viewer and the client clock for the time label.
const VIEWER: User = { name: "You", email: "", initials: "YOU" };

function timeLabel(d: Date): string {
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

function wsUrlFor(baseUrl: string, projectId: string): string {
  return `${baseUrl.replace(/^http/, "ws")}/v1/projects/${encodeURIComponent(projectId)}/stream`;
}

export function createLiveSource(baseUrl: string): WaypointSource {
  return {
    initial: () => null, // no synchronous snapshot — the provider shows loading until load() resolves
    load: async (): Promise<ProjectsData> => {
      const now = new Date();
      const { projects } = await fetchProjects(baseUrl);
      const built = await Promise.all(
        projects.map(async (summary) => {
          const [progress, inbox, events] = await Promise.all([
            fetchProgress(baseUrl, summary.id),
            fetchInbox(baseUrl, summary.id),
            fetchEvents(baseUrl, summary.id),
          ]);
          return toProject(summary, progress, inbox.items, events.events, now.getTime());
        }),
      );
      return {
        now: timeLabel(now),
        user: VIEWER,
        projects: built,
        notifications: deriveNotifications(built),
      };
    },
    // Open a per-project WebSocket and ask the provider to re-load on any delta/resync — a
    // coarse full-snapshot refresh (not incremental delta application), which keeps "no poll"
    // while staying simple. Guarded for environments without a WebSocket (SSR/tests).
    subscribe: (onChange) => {
      if (typeof WebSocket === "undefined") return () => {};
      let closed = false;
      const sockets: WebSocket[] = [];
      void fetchProjects(baseUrl)
        .then(({ projects }) => {
          if (closed) return;
          for (const p of projects) {
            const ws = new WebSocket(wsUrlFor(baseUrl, p.id));
            ws.addEventListener("open", () =>
              ws.send(JSON.stringify({ type: "resume", projectId: p.id, lastSeq: null })),
            );
            ws.addEventListener("message", (e: MessageEvent) => {
              try {
                const frame = JSON.parse(String(e.data)) as { type?: string };
                if (frame.type === "delta" || frame.type === "resync") onChange();
              } catch {
                // ignore a malformed frame
              }
            });
            sockets.push(ws);
          }
        })
        .catch(() => {
          // a failed project list just means no live push this session; load() already errored
        });
      return () => {
        closed = true;
        for (const ws of sockets) ws.close();
      };
    },
    answer: async (command: AnswerCommand): Promise<void> => {
      await answerAsk(baseUrl, command.projectId, command.decisionId, {
        expectedVersion: command.expectedVersion,
        ...(command.chosenOptionId !== undefined ? { chosenOptionId: command.chosenOptionId } : {}),
        ...(command.adjustmentNote !== undefined
          ? { proposalVerdict: "adjust", adjustmentNote: command.adjustmentNote }
          : {}),
      });
    },
  };
}
