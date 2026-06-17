// View-model types for the storybook UI (mock-first phase).
//
// Faithful to the Claude Design handoff's `WP_DATA`
// (docs/design/storybook-handoff/project/wp-data.jsx). These are WEB-LOCAL UI shapes,
// intentionally NOT placed in `shared` — see the design spec (decisions D2/D5): the mock
// fixtures are trusted internal literals, so plain typed interfaces (guarded by a
// shape-consistency test) stand in for zod this phase; real zod schemas land in `shared`
// at the wiring phase, where live data is the actual external boundary.
//
// Prototype → backend mapping (recorded now, applied at wiring, not here):
//   Stream ≈ plan · Decision ≈ ask (extended) · ActivityGroup ≈ append-only event log ·
//   Notification ≈ derived from open asks + events.

export type TaskStatus = "done" | "active" | "blocked" | "queued";
export type StreamStatus = "done" | "active" | "blocked" | "queued";
export type AgentStatus = "working" | "idle";
export type Risk = "low" | "medium" | "high";
export type ImpactKind = "info" | "danger";
export type MessageWho = "agent" | "you" | "system";
export type NotificationTone = "warning" | "success" | "accent";
export type ActivityKind = "edit" | "parked" | "done" | "you";

// Inbox filter — a discriminated union that fixes the prototype's `"non"` filter bug
// (it set state to "non" while the predicate checked a non-existent branch).
export type FilterKind = "all" | "blocking" | "non-blocking";

export interface User {
  name: string;
  email: string;
  initials: string;
}

export interface Task {
  name: string;
  status: TaskStatus;
  note?: string;
  decision?: string; // decision id, present when status === "blocked"
  here?: boolean; // the "you are here" marker
}

export interface Stream {
  id: string;
  name: string;
  status: StreamStatus;
  tasks: Task[];
}

export interface Option {
  name: string;
  rec?: boolean; // the agent's recommended option
  pros: string[];
  cons: string[];
  // The backend option id (`opt-N`), carried by the live adapter so an answer can identify the
  // choice; absent for mock fixtures (the mock answer is a no-op).
  id?: string;
}

export interface Message {
  who: MessageWho;
  t: string; // timestamp label, e.g. "11:12"
  text: string;
}

export interface Impact {
  kind: ImpactKind;
  text: string;
}

export interface Decision {
  id: string;
  risk: Risk;
  reversible: boolean;
  blocking: boolean;
  stream: string;
  blocksTask: string;
  title: string;
  parked: string; // e.g. "12m ago"
  // The prototype's free-form "agent continued on N unblocked tasks" string. At wiring the
  // live type replaces this with a computed `unblockedTaskCount: number` (avoid silent drift).
  continuedDescription: string;
  file: string;
  context: string;
  options: Option[];
  recReason: string; // the recommended option's name, echoed in copy
  impact: Impact;
  thread: Message[];
  // The ask version, carried by the live adapter for optimistic-concurrency answers; absent for
  // mock fixtures.
  version?: number;
  // The ask kind, carried by the live adapter. Drives the thread composer: a PROPOSAL takes an
  // "Approve with adjustment", a DECISION/QUESTION is read-only (answered via options). Absent for
  // mock fixtures, which keep the prototype's free-form composer.
  kind?: DecisionKind;
}

export type DecisionKind = "question" | "proposal" | "decision";

export interface ActivityItem {
  kind: ActivityKind;
  stream: string;
  text: string;
  sub: string;
}

export interface ActivityGroup {
  time: string;
  items: ActivityItem[];
}

export interface Project {
  id: string;
  name: string;
  desc: string;
  glyph: string;
  color: string; // hex; rendered via a CSS custom property, not a hardcoded style rule
  agent: AgentStatus;
  agentTasks: number;
  streams: Stream[];
  decisions: Decision[];
  activity: ActivityGroup[];
}

export interface NotificationTarget {
  project: string;
  decision?: string;
  view?: string;
}

export interface Notification {
  id: string;
  unread: boolean;
  tone: NotificationTone;
  icon: string; // icon name from the Lucide subset
  project: string;
  text: string;
  time: string;
  to: NotificationTarget;
}

export interface ProjectsData {
  now: string;
  user: User;
  projects: Project[];
  notifications: Notification[];
}
