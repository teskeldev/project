import { z } from "zod";

/**
 * Phase 7b — Rules + Knowledge validators.
 *
 * Kept in a dedicated module (not appended to the shared validators.ts) so the
 * feature owns its schema surface. Mirrors the Prisma `RuleScope` /
 * `KnowledgeType` enums and the authz coherence rules enforced in the routes.
 */

export const ruleScopeSchema = z.enum([
  "GLOBAL",
  "WORKSPACE",
  "PROJECT",
  "FILE",
]);
export type RuleScopeInput = z.infer<typeof ruleScopeSchema>;

export const knowledgeTypeSchema = z.enum([
  "TEXT",
  "FILE",
  "URL",
  "NOTE",
]);
export type KnowledgeTypeInput = z.infer<typeof knowledgeTypeSchema>;

/**
 * Create a Rule.
 *
 * Scope/id coherence is enforced via `superRefine` so the API layer can rely on
 * the parsed shape:
 *   - PROJECT  -> requires projectId
 *   - WORKSPACE -> requires workspaceId
 *   - FILE     -> requires filePattern (file-scoped rules attach to a project)
 *   - GLOBAL   -> no workspaceId/projectId
 */
export const createRuleSchema = z
  .object({
    scope: ruleScopeSchema,
    title: z.string().trim().min(1, "Title is required").max(200),
    content: z.string().trim().min(1, "Content is required").max(20000),
    filePattern: z.string().trim().max(300).optional(),
    workspaceId: z.string().min(1).optional(),
    projectId: z.string().min(1).optional(),
    enabled: z.boolean().optional().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.scope === "GLOBAL") {
      if (v.workspaceId || v.projectId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "GLOBAL rules must not target a workspace or project",
          path: ["scope"],
        });
      }
    }
    if (v.scope === "WORKSPACE" && !v.workspaceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "WORKSPACE rules require a workspaceId",
        path: ["workspaceId"],
      });
    }
    if (v.scope === "PROJECT" && !v.projectId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "PROJECT rules require a projectId",
        path: ["projectId"],
      });
    }
    if (v.scope === "FILE") {
      if (!v.filePattern) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "FILE rules require a filePattern",
          path: ["filePattern"],
        });
      }
      if (!v.projectId && !v.workspaceId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "FILE rules must target a project or workspace",
          path: ["projectId"],
        });
      }
    }
  });
export type CreateRuleInput = z.infer<typeof createRuleSchema>;

/** Update a Rule. Scope/ids are immutable; only mutable fields are accepted. */
export const updateRuleSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().trim().min(1).max(20000).optional(),
    filePattern: z.string().trim().max(300).nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "No fields to update",
  });
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;

/**
 * Create a KnowledgeItem.
 *
 * `metadata` is a free-form JSON object (we use `metadata.starred` for the UI
 * star). For type URL, callers should also put the url in `content` (the route
 * normalizes this); fetching/scraping the URL is future work.
 */
export const createKnowledgeSchema = z.object({
  workspaceId: z.string().min(1, "workspaceId is required"),
  projectId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(1, "Title is required").max(200),
  type: knowledgeTypeSchema,
  content: z.string().min(1, "Content is required").max(100000),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateKnowledgeInput = z.infer<typeof createKnowledgeSchema>;

/** Update a KnowledgeItem. workspaceId is immutable. */
export const updateKnowledgeSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    type: knowledgeTypeSchema.optional(),
    content: z.string().min(1).max(100000).optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
    projectId: z.string().min(1).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "No fields to update",
  });
export type UpdateKnowledgeInput = z.infer<typeof updateKnowledgeSchema>;

/** Keyword search over accessible knowledge items. */
export const knowledgeSearchSchema = z.object({
  q: z.string().trim().min(1, "Query is required").max(500),
  projectId: z.string().min(1).nullable().optional(),
});
export type KnowledgeSearchInput = z.infer<typeof knowledgeSearchSchema>;
