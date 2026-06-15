// Shared status/progress helpers, ported from the handoff's wp-ui.jsx. Pure functions over
// the view-model types so screens (and their tests) stay thin.

import type { IconName } from "./icons.js";
import type { Stream, TaskStatus } from "./types.js";

// Which icon represents each task status in the project map.
export const taskIconName: Record<TaskStatus, IconName> = {
  done: "checkCircle",
  active: "circleDot",
  blocked: "diamond",
  queued: "circle",
};

export interface StreamProgress {
  done: number;
  total: number;
  pct: number;
}

// Fraction of a stream's tasks that are done. Guards total === 0 (the prototype did not).
export function streamProgress(stream: Stream): StreamProgress {
  const total = stream.tasks.length;
  const done = stream.tasks.filter((t) => t.status === "done").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, pct };
}

// The progress-bar fill colour for a stream, as a design-token CSS variable reference.
export function streamBarColor(stream: Stream): string {
  if (stream.status === "done") return "var(--green-600)";
  if (stream.status === "blocked") return "var(--amber-500)";
  if (stream.status === "queued") return "var(--ink-300)";
  return "var(--accent-500)";
}
