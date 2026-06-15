import { z } from "zod";

/** Workspace creation: name -> slug derived server-side. */
export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

/** Project creation. template seeds initial files. */
export const createProjectSchema = z.object({
  workspaceId: z.string().min(1, "workspaceId is required"),
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(2000).optional(),
  template: z.enum(["blank", "node"]).optional().default("blank"),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

/** Project update (PATCH). */
export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    defaultBranch: z.string().trim().min(1).max(100).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "No fields to update",
  });
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

/** Create a file or folder node. */
export const createFileNodeSchema = z.object({
  parentPath: z.string().optional(),
  path: z.string().optional(),
  name: z.string().trim().min(1, "Name is required").max(255),
  type: z.enum(["FILE", "FOLDER"]),
  content: z.string().optional(),
});
export type CreateFileNodeInput = z.infer<typeof createFileNodeSchema>;

/** Save file content (editor Save). */
export const saveFileSchema = z.object({
  path: z.string().min(1, "path is required"),
  content: z.string().max(2 * 1024 * 1024),
});
export type SaveFileInput = z.infer<typeof saveFileSchema>;

/** Delete node by path (used for DELETE body). */
export const deleteNodeSchema = z.object({
  path: z.string().min(1, "path is required"),
});
export type DeleteNodeInput = z.infer<typeof deleteNodeSchema>;

/** Rename/move a node. Accepts either {oldPath,newPath} or {path,newName}. */
export const renameNodeSchema = z
  .object({
    oldPath: z.string().optional(),
    newPath: z.string().optional(),
    path: z.string().optional(),
    newName: z.string().trim().min(1).max(255).optional(),
  })
  .refine(
    (v) => (!!v.oldPath && !!v.newPath) || (!!v.path && !!v.newName),
    { message: "Provide either {oldPath,newPath} or {path,newName}" }
  );
export type RenameNodeInput = z.infer<typeof renameNodeSchema>;

// ----------------------------- Chat / AI -----------------------------

/** Create a chat thread. */
export const createThreadSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
});
export type CreateThreadInput = z.infer<typeof createThreadSchema>;

/** Append a USER message to a thread (non-streaming persist path). */
export const createMessageSchema = z.object({
  role: z.literal("USER").default("USER"),
  content: z.string().min(1, "content is required"),
});
export type CreateMessageInput = z.infer<typeof createMessageSchema>;

/** Streaming chat request. */
export const chatStreamSchema = z.object({
  threadId: z.string().min(1, "threadId is required"),
  content: z.string().min(1, "content is required").max(64000),
  selectedPaths: z.array(z.string()).max(100).optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
  fusionId: z.string().optional(),
  useQualityEngine: z.boolean().optional(),
  qualityLevel: z.enum(["fast", "balanced", "maximum"]).optional(),
});
export type ChatStreamInput = z.infer<typeof chatStreamSchema>;

/** Generate a structured changeset from a natural-language instruction. */
export const generateChangeSetSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  instruction: z.string().min(1, "instruction is required").max(8000),
  selectedPaths: z.array(z.string()).optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
  fusionId: z.string().optional(),
  useQualityEngine: z.boolean().optional(),
});
export type GenerateChangeSetInput = z.infer<typeof generateChangeSetSchema>;

// ----------------------------- ChangeSets / Review -----------------------------

/** PATCH a single file change's review status. */
export const updateFileChangeSchema = z.object({
  status: z.enum(["ACCEPTED", "REJECTED"]),
});
export type UpdateFileChangeInput = z.infer<typeof updateFileChangeSchema>;

/**
 * Apply a changeset. When applyAll is true, PENDING file changes are applied
 * alongside ACCEPTED ones; otherwise only ACCEPTED changes are applied.
 * REJECTED changes are always skipped.
 */
export const applyChangeSetSchema = z
  .object({
    applyAll: z.boolean().optional().default(false),
  })
  .default({ applyAll: false });
export type ApplyChangeSetInput = z.infer<typeof applyChangeSetSchema>;
// ----------------------------- Git (Phase 5b) -----------------------------

/**
 * Branch-name validation. Rejects shell metacharacters and git-illegal
 * sequences. Permits the common `feature/foo-bar` style names.
 */
export const branchNameSchema = z
  .string()
  .trim()
  .min(1, "Branch name is required")
  .max(200, "Branch name is too long")
  .regex(
    /^(?!\/)(?!.*\/\/)(?!.*\.\.)(?!.*@\{)(?!.*\.lock(?:\/|$))[A-Za-z0-9._\/-]+$/,
    "Invalid branch name"
  )
  .refine((v) => !v.endsWith("/") && !v.endsWith("."), {
    message: "Invalid branch name",
  });

/** Create a new branch. */
export const gitBranchSchema = z.object({
  name: branchNameSchema,
});
export type GitBranchInput = z.infer<typeof gitBranchSchema>;

/** Checkout an existing branch. */
export const gitCheckoutSchema = z.object({
  name: branchNameSchema,
});
export type GitCheckoutInput = z.infer<typeof gitCheckoutSchema>;

/** Stage / unstage a set of project-relative paths. */
export const gitPathsSchema = z.object({
  paths: z.array(z.string().min(1)).min(1, "At least one path is required"),
});
export type GitPathsInput = z.infer<typeof gitPathsSchema>;

/** Commit staged (or specified) changes. */
export const gitCommitSchema = z.object({
  message: z.string().trim().min(1, "Commit message is required").max(2000),
  paths: z.array(z.string().min(1)).optional(),
});
export type GitCommitInput = z.infer<typeof gitCommitSchema>;

// ----------------------------- Terminal (Phase 5a) -----------------------------

/** Create a terminal session. cwd defaults to the project root server-side. */
export const createTerminalSessionSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  cwd: z.string().trim().max(1024).optional(),
});
export type CreateTerminalSessionInput = z.infer<
  typeof createTerminalSessionSchema
>;

/** Run a command in a terminal session. */
export const runCommandSchema = z.object({
  command: z.string().min(1, "command is required").max(4000),
});
export type RunCommandInput = z.infer<typeof runCommandSchema>;

