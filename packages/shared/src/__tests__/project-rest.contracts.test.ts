import { describe, it, expect } from "vitest";
import { ProjectSummarySchema, ProjectListResponseSchema } from "../project.js";
import { EventLogResponseSchema } from "../event.js";

describe("project-list DTOs", () => {
  const summary = {
    id: "orbit-api",
    name: "orbit-api",
    openAskCount: 3,
    agentTaskCount: 6,
    lastActivityAt: 1_700_000_000_000,
  };

  it("parses a project summary with derived counts", () => {
    const v = ProjectSummarySchema.parse(summary);
    expect(v.openAskCount).toBe(3);
    expect(v.agentTaskCount).toBe(6);
  });

  it("allows lastActivityAt to be absent (a project with no events yet)", () => {
    const noActivity = { id: "p", name: "p", openAskCount: 0, agentTaskCount: 0 };
    expect(ProjectSummarySchema.parse(noActivity).lastActivityAt).toBeUndefined();
  });

  it("rejects a negative ask count", () => {
    expect(ProjectSummarySchema.safeParse({ ...summary, openAskCount: -1 }).success).toBe(false);
  });

  it("parses a project list response", () => {
    const v = ProjectListResponseSchema.parse({ projects: [summary] });
    expect(v.projects).toHaveLength(1);
  });

  it("parses an empty project list", () => {
    expect(ProjectListResponseSchema.parse({ projects: [] }).projects).toEqual([]);
  });
});

describe("project-events DTO", () => {
  const event = {
    id: "e1",
    projectId: "orbit-api",
    seq: 4,
    actor: "agent",
    verb: "ask.parked",
    ref: { kind: "ask", id: "d1" },
    sessionId: null,
    summary: "parked a decision",
    at: 1_700_000_000_000,
  };

  it("parses an event-log response carrying the project's events", () => {
    const v = EventLogResponseSchema.parse({ projectId: "orbit-api", seq: 4, events: [event] });
    expect(v.projectId).toBe("orbit-api");
    expect(v.seq).toBe(4);
    expect(v.events[0]?.verb).toBe("ask.parked");
  });

  it("parses an empty event log", () => {
    expect(EventLogResponseSchema.parse({ projectId: "p", seq: 0, events: [] }).events).toEqual([]);
  });

  it("rejects an unknown event verb", () => {
    const bad = { ...event, verb: "ask.exploded" };
    expect(
      EventLogResponseSchema.safeParse({ projectId: "p", seq: 1, events: [bad] }).success,
    ).toBe(false);
  });
});
