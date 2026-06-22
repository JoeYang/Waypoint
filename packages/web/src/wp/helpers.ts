// Shared status/progress helpers, ported from the handoff's wp-ui.jsx. Pure functions over
// the view-model types so screens (and their tests) stay thin.

import type { IconName } from "./icons.js";
import type { Project, Stream, Task, TaskStatus } from "./types.js";

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

// All of a project's tasks, flattened across its streams.
export function projectTasks(project: Project): Task[] {
  return project.streams.flatMap((s) => s.tasks);
}

export interface ProjectTally {
  done: number;
  active: number;
  parked: number; // tasks blocked on a parked decision
  total: number;
}

// Segmented-meter tally for a project's tasks across all streams. `parked` counts blocked tasks
// (each blocked task is waiting on a parked decision); `total` is every task.
export function projectTally(project: Project): ProjectTally {
  const tasks = projectTasks(project);
  let done = 0;
  let active = 0;
  let parked = 0;
  for (const t of tasks) {
    if (t.status === "done") done += 1;
    else if (t.status === "active") active += 1;
    else if (t.status === "blocked") parked += 1;
  }
  return { done, active, parked, total: tasks.length };
}

// The project's current task: the one explicitly marked `here`, else the first active task, else
// undefined (nothing in flight to point at).
export function currentTask(project: Project): Task | undefined {
  const tasks = projectTasks(project);
  return tasks.find((t) => t.here === true) ?? tasks.find((t) => t.status === "active");
}
