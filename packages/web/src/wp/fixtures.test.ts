import { describe, it, expect } from "vitest";
import { WP_DATA } from "./fixtures.js";
import type {
  ActivityKind,
  MessageWho,
  NotificationTone,
  Risk,
  StreamStatus,
  TaskStatus,
} from "./types.js";

// This suite is the drift guard that stands in for zod this phase (design spec D5): it asserts
// every fixture object satisfies the same shape and that the cross-references between tasks,
// decisions, and notifications are internally consistent. If a field is added to one project but
// not another, or a blocked task points at a missing decision, these tests fail.

const TASK_STATUSES: readonly TaskStatus[] = ["done", "active", "blocked", "queued"];
const STREAM_STATUSES: readonly StreamStatus[] = ["done", "active", "blocked", "queued"];
const RISKS: readonly Risk[] = ["low", "medium", "high"];
const WHO: readonly MessageWho[] = ["agent", "you", "system"];
const TONES: readonly NotificationTone[] = ["warning", "success", "accent"];
const ACTIVITY_KINDS: readonly ActivityKind[] = ["edit", "parked", "done", "you"];

const nonEmpty = (s: unknown): boolean => typeof s === "string" && s.length > 0;

describe("WP_DATA fixture shape", () => {
  it("has the top-level shape", () => {
    expect(nonEmpty(WP_DATA.now)).toBe(true);
    expect(nonEmpty(WP_DATA.user.name)).toBe(true);
    expect(nonEmpty(WP_DATA.user.email)).toBe(true);
    expect(nonEmpty(WP_DATA.user.initials)).toBe(true);
    expect(WP_DATA.projects.length).toBeGreaterThan(0);
    expect(WP_DATA.notifications.length).toBeGreaterThan(0);
  });

  it("every project satisfies the same shape", () => {
    for (const p of WP_DATA.projects) {
      expect(nonEmpty(p.id)).toBe(true);
      expect(nonEmpty(p.name)).toBe(true);
      expect(nonEmpty(p.desc)).toBe(true);
      expect(nonEmpty(p.glyph)).toBe(true);
      expect(p.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(["working", "idle"]).toContain(p.agent);
      expect(typeof p.agentTasks).toBe("number");
      expect(Array.isArray(p.streams)).toBe(true);
      expect(Array.isArray(p.decisions)).toBe(true);
      expect(Array.isArray(p.activity)).toBe(true);
    }
  });

  it("every stream and task is well-formed", () => {
    for (const p of WP_DATA.projects) {
      for (const s of p.streams) {
        expect(nonEmpty(s.id)).toBe(true);
        expect(nonEmpty(s.name)).toBe(true);
        expect(STREAM_STATUSES).toContain(s.status);
        expect(s.tasks.length).toBeGreaterThan(0);
        for (const t of s.tasks) {
          expect(nonEmpty(t.name)).toBe(true);
          expect(TASK_STATUSES).toContain(t.status);
        }
      }
    }
  });

  it("every blocked task references a decision that exists in its project", () => {
    for (const p of WP_DATA.projects) {
      const ids = new Set(p.decisions.map((d) => d.id));
      for (const s of p.streams) {
        for (const t of s.tasks) {
          if (t.status === "blocked") {
            expect(t.decision).toBeDefined();
            expect(ids.has(t.decision as string)).toBe(true);
          }
        }
      }
    }
  });

  it("every decision is well-formed with exactly one recommendation matching recReason", () => {
    for (const p of WP_DATA.projects) {
      for (const d of p.decisions) {
        expect(nonEmpty(d.id)).toBe(true);
        expect(RISKS).toContain(d.risk);
        expect(typeof d.reversible).toBe("boolean");
        expect(typeof d.blocking).toBe("boolean");
        expect(nonEmpty(d.title)).toBe(true);
        expect(nonEmpty(d.parked)).toBe(true);
        expect(nonEmpty(d.continuedDescription)).toBe(true);
        expect(nonEmpty(d.context)).toBe(true);
        expect(["info", "danger"]).toContain(d.impact.kind);
        expect(nonEmpty(d.impact.text)).toBe(true);

        expect(d.options.length).toBeGreaterThan(0);
        const recommended = d.options.filter((o) => o.rec === true);
        expect(recommended).toHaveLength(1);
        expect(recommended[0]?.name).toBe(d.recReason);
        for (const o of d.options) {
          expect(nonEmpty(o.name)).toBe(true);
          expect(o.pros.length + o.cons.length).toBeGreaterThan(0);
        }

        expect(d.thread.length).toBeGreaterThan(0);
        for (const m of d.thread) {
          expect(WHO).toContain(m.who);
          expect(nonEmpty(m.t)).toBe(true);
          expect(nonEmpty(m.text)).toBe(true);
        }
      }
    }
  });

  it("every activity item is well-formed", () => {
    for (const p of WP_DATA.projects) {
      for (const g of p.activity) {
        expect(nonEmpty(g.time)).toBe(true);
        expect(g.items.length).toBeGreaterThan(0);
        for (const it of g.items) {
          expect(ACTIVITY_KINDS).toContain(it.kind);
          expect(nonEmpty(it.text)).toBe(true);
        }
      }
    }
  });

  it("every notification targets a project (and decision, if set) that exists", () => {
    const projects = new Map(WP_DATA.projects.map((p) => [p.id, p]));
    for (const n of WP_DATA.notifications) {
      expect(nonEmpty(n.id)).toBe(true);
      expect(TONES).toContain(n.tone);
      expect(nonEmpty(n.icon)).toBe(true);
      expect(nonEmpty(n.text)).toBe(true);
      const target = projects.get(n.to.project);
      expect(target).toBeDefined();
      if (n.to.decision) {
        expect(target?.decisions.some((d) => d.id === n.to.decision)).toBe(true);
      }
    }
  });
});
