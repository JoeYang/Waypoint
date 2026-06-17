// Pure mappers: backend DTOs → the web view-model. This is the whole adapter the design seam
// (D2) promised — the live source composes these so no screen changes. The presentational
// view-model is richer than the backend; every field with no backend source uses a documented
// rule (see the live-wiring proposal D8) rather than crashing on an undefined.

import type {
  ProjectProgress,
  PlanProgress,
  TaskProgress,
  InboxItem,
  ProjectSummary,
  PlanState,
  TaskState,
} from "@waypoint/shared";
import type { Project, Stream, Task, Decision, Option, StreamStatus, TaskStatus } from "./types.js";

// Plan/task states → the web's presentational statuses. The backend has no `queued` (plans are
// active/blocked/done) and the web has no `failed`; a failed (DISCARDED) task reads as `blocked`
// — needs-attention, and non-interactive since it carries no decision. (A real `failed` view
// state is a deferred view-model addition.)
const PLAN_TO_STREAM: Record<PlanState, StreamStatus> = {
  active: "active",
  blocked: "blocked",
  done: "done",
};
const TASK_TO_WEB: Record<TaskState, TaskStatus> = {
  running: "active",
  done: "done",
  "blocked-on-ask": "blocked",
  failed: "blocked",
};

export function toTask(t: TaskProgress): Task {
  const status = TASK_TO_WEB[t.state];
  const decisionId = t.state === "blocked-on-ask" ? t.asks[0]?.askId : undefined;
  return {
    name: t.title,
    status,
    ...(t.agentLabel !== null && status === "active" ? { note: `${t.agentLabel} is here` } : {}),
    ...(decisionId !== undefined ? { decision: decisionId } : {}),
  };
}

export function toStream(p: PlanProgress): Stream {
  return {
    id: p.nodeId,
    name: p.title,
    status: PLAN_TO_STREAM[p.state],
    tasks: p.tasks.map(toTask),
  };
}

// Plans (flattened across goals) are the web's parallel work streams; the goal layer has no
// surface in the web view-model.
export function progressToStreams(progress: ProjectProgress): Stream[] {
  return progress.goals.flatMap((g) => g.plans).map(toStream);
}

function relativeTime(at: number, nowMs: number): string {
  const m = Math.floor(Math.max(0, nowMs - at) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

function impactText(item: InboxItem): string {
  const n = item.blocks?.length ?? 0;
  return n > 0
    ? `Blocks ${n} downstream task${n > 1 ? "s" : ""} until you decide.`
    : "The agent continues on other work until you decide.";
}

// Decision ← InboxItem, per the D8 provenance table. `risk`/`reversible` are now real
// (agent-supplied, group A). No backend signal exists for a recommended option or a source
// file, so `recReason` is empty (no rec tag) and `file` is dropped; the option `consequence`
// surfaces as a single pro line (the backend carries no pro/con split).
export function toDecision(item: InboxItem, streamName: string, nowMs: number): Decision {
  return {
    id: item.askId,
    risk: item.risk,
    reversible: item.reversible,
    blocking: item.required,
    stream: streamName,
    blocksTask: item.nodeTitle,
    title: item.prompt,
    parked: relativeTime(item.parkedAt, nowMs),
    continuedDescription:
      (item.blocks?.length ?? 0) > 0 ? "the rest of the stream" : "other unblocked work",
    file: "",
    context: item.rationale ?? "",
    options: item.options.map(
      (o): Option => ({ name: o.label, pros: o.consequence ? [o.consequence] : [], cons: [] }),
    ),
    recReason: "",
    impact: { kind: item.risk === "high" ? "danger" : "info", text: impactText(item) },
    thread: [],
  };
}

// Presentational chrome (D4) — glyph/colour/desc have no backend source. A caller may supply a
// config keyed by project id; absent that, derive a deterministic, distinct look from the id.
export interface ProjectChrome {
  glyph: string;
  color: string;
  desc: string;
}
const FALLBACK_COLORS = ["#3b4cad", "#2f8a6f", "#b8841f", "#a14b8a", "#3a7ca5"];
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function deterministicChrome(id: string, name: string): ProjectChrome {
  return {
    glyph: name.slice(0, 2).toUpperCase(),
    color: FALLBACK_COLORS[hash(id) % FALLBACK_COLORS.length]!,
    desc: "",
  };
}

// Assemble one web Project from its summary + progress + inbox. Activity (the event log) is
// folded in at PR7; it is empty here.
export function toProject(
  summary: ProjectSummary,
  progress: ProjectProgress,
  inboxItems: InboxItem[],
  nowMs: number,
  chrome: Record<string, ProjectChrome> = {},
): Project {
  const streams = progressToStreams(progress);
  const planTitleByTaskNode = new Map<string, string>();
  for (const g of progress.goals)
    for (const p of g.plans) for (const t of p.tasks) planTitleByTaskNode.set(t.nodeId, p.title);

  const ch = chrome[summary.id] ?? deterministicChrome(summary.id, summary.name);
  return {
    id: summary.id,
    name: summary.name,
    desc: ch.desc,
    glyph: ch.glyph,
    color: ch.color,
    agent: summary.agentTaskCount > 0 ? "working" : "idle",
    agentTasks: summary.agentTaskCount,
    streams,
    decisions: inboxItems.map((it) =>
      toDecision(it, planTitleByTaskNode.get(it.nodeId) ?? it.nodeTitle, nowMs),
    ),
    activity: [],
  };
}
