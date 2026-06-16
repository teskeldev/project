/**
 * AI tool permission system.
 * Controls what actions the AI can perform without asking.
 *
 * Tools: file_edit, file_delete, file_create, terminal, git_commit, git_push,
 *        agent_run, changeset_apply, web_fetch, search
 * Actions: ALLOW (silent), ASK (prompt user), DENY (block)
 * Patterns: glob patterns for file paths or command patterns
 */
import { prisma } from "@/lib/db";

export type AITool =
  | "file_edit" // Edit/write files
  | "file_delete" // Delete files
  | "file_create" // Create new files
  | "terminal" // Execute terminal commands
  | "git_commit" // Git commit
  | "git_push" // Git push to remote
  | "agent_run" // Start background agents
  | "changeset_apply" // Apply changesets to disk
  | "web_fetch" // Fetch external URLs
  | "search"; // Search codebase

export type PermissionCheck = {
  tool: AITool;
  pattern?: string; // file path or command being acted on
};

export type PermissionResult = {
  action: "ALLOW" | "ASK" | "DENY";
  rule?: { id: string; tool: string; pattern: string };
};

// Default permissions (when no rules exist)
const DEFAULTS: Record<AITool, "ALLOW" | "ASK" | "DENY"> = {
  file_edit: "ALLOW",
  file_delete: "ASK",
  file_create: "ALLOW",
  terminal: "ASK",
  git_commit: "ALLOW",
  git_push: "ASK",
  agent_run: "ASK",
  changeset_apply: "ASK",
  web_fetch: "ALLOW",
  search: "ALLOW",
};

// Sensitive file patterns that always require ASK
const SENSITIVE_PATTERNS = [
  "*.env*",
  "*secret*",
  "*password*",
  "*.key",
  "*.pem",
  "*credentials*",
];

/**
 * Check if an AI action is permitted.
 */
export async function checkPermission(
  workspaceId: string,
  check: PermissionCheck
): Promise<PermissionResult> {
  // 1. Check sensitive patterns first (always ASK)
  if (check.pattern) {
    for (const sensitive of SENSITIVE_PATTERNS) {
      if (matchGlob(sensitive, check.pattern)) {
        return { action: "ASK" };
      }
    }
  }

  // 2. Check workspace rules (most specific match wins)
  const rules = await prisma.aIPermission.findMany({
    where: { workspaceId, tool: check.tool },
    orderBy: { pattern: "desc" }, // more specific patterns first
  });

  for (const rule of rules) {
    if (matchGlob(rule.pattern, check.pattern || "*")) {
      return {
        action: rule.action,
        rule: { id: rule.id, tool: rule.tool, pattern: rule.pattern },
      };
    }
  }

  // 3. Fall back to defaults
  return { action: DEFAULTS[check.tool] || "ASK" };
}

/**
 * Simple glob matching: * matches anything, ? matches one char.
 */
function matchGlob(pattern: string, value: string): boolean {
  if (pattern === "*") return true;
  const regex = new RegExp(
    "^" +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".") +
      "$",
    "i"
  );
  return regex.test(value);
}

// CRUD for permission rules

export async function listPermissions(workspaceId: string) {
  return prisma.aIPermission.findMany({
    where: { workspaceId },
    orderBy: [{ tool: "asc" }, { pattern: "asc" }],
  });
}

export async function createPermission(
  workspaceId: string,
  data: { tool: AITool; pattern: string; action: "ALLOW" | "ASK" | "DENY" }
) {
  return prisma.aIPermission.create({
    data: {
      workspaceId,
      tool: data.tool,
      pattern: data.pattern || "*",
      action: data.action,
    },
  });
}

export async function updatePermission(
  id: string,
  data: { action: "ALLOW" | "ASK" | "DENY" }
) {
  return prisma.aIPermission.update({
    where: { id },
    data: { action: data.action },
  });
}

export async function deletePermission(id: string) {
  return prisma.aIPermission.delete({
    where: { id },
  });
}

/**
 * Get the default permission for a tool (used for display purposes).
 */
export function getDefaultPermission(tool: AITool): "ALLOW" | "ASK" | "DENY" {
  return DEFAULTS[tool] || "ASK";
}

/**
 * List of all available tools with descriptions.
 */
export const AI_TOOL_DESCRIPTIONS: Record<AITool, string> = {
  file_edit: "Edit or write existing files",
  file_delete: "Delete files from the project",
  file_create: "Create new files in the project",
  terminal: "Execute terminal/shell commands",
  git_commit: "Create git commits",
  git_push: "Push commits to remote repository",
  agent_run: "Start background AI agents",
  changeset_apply: "Apply code changesets to disk",
  web_fetch: "Fetch content from external URLs",
  search: "Search the codebase",
};
