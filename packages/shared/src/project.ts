import { z } from "zod";

// A tenant boundary and the unit get_context operates over. `project_id` is carried
// on every row as the future multi-tenant boundary (auth deferred; see security.md).
export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.number().int().nonnegative(), // epoch ms
});

export type Project = z.infer<typeof ProjectSchema>;

// GET /v1/projects — one row per project for the cross-project home. Counts are derived
// read-time (open asks, agent-occupied tasks); `lastActivityAt` is the newest event's
// timestamp, absent for a project with no events yet.
export const ProjectSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  openAskCount: z.number().int().nonnegative(),
  agentTaskCount: z.number().int().nonnegative(),
  lastActivityAt: z.number().int().nonnegative().optional(),
});
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;

export const ProjectListResponseSchema = z.object({
  projects: z.array(ProjectSummarySchema),
});
export type ProjectListResponse = z.infer<typeof ProjectListResponseSchema>;
