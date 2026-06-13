import { z } from "zod";

// A tenant boundary and the unit get_context operates over. `project_id` is carried
// on every row as the future multi-tenant boundary (auth deferred; see security.md).
export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.number().int().nonnegative(), // epoch ms
});

export type Project = z.infer<typeof ProjectSchema>;
