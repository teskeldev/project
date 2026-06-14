/**
 * Teskel project-scoped tool implementations.
 *
 * Creates tools that interact with the actual project database (FileNode
 * table) and storage layer. These replace the placeholder implementations
 * in ./index.ts with real data access, scoped to a specific project.
 *
 * The existing agent runner (runner.ts) uses hardcoded functions for file
 * listing, search, and reading. This module provides the same capabilities
 * as composable Tool instances compatible with the new AgentBuilder system.
 *
 * SAFETY:
 *  - All file reads go through the database (FileNode) or the safe storage
 *    layer (resolveSafe). No raw filesystem paths are accepted.
 *  - Write operations produce a ChangeSet for user approval rather than
 *    writing directly to disk, matching the existing runner's safety model.
 *  - Search is delegated to the existing search engine with result limits.
 */
import { z } from "zod";
import { createTool } from "../core";
import type { AnyTool } from "../core";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of file nodes returned by list_files. */
const MAX_LIST_RESULTS = 200;

/** Maximum number of search results returned. */
const MAX_SEARCH_RESULTS = 50;

/** Maximum content length returned for a single file read (characters). */
const MAX_FILE_CONTENT = 50_000;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a set of project-scoped tools that interact with the database.
 *
 * Each tool is bound to the given `projectId` and queries the FileNode
 * table for file metadata and content. This mirrors the hardcoded tool
 * functions in runner.ts (listFiles, searchCode, readSnippet) but wraps
 * them as composable Tool instances for the new agent system.
 *
 * @param projectId - The project ID to scope all operations to.
 * @returns An object containing the project-scoped tools.
 *
 * @example
 * ```ts
 * const tools = createProjectTools("proj_abc123");
 * const agent = new AgentBuilder("assistant", model)
 *   .tool(tools.listFiles)
 *   .tool(tools.readFile)
 *   .tool(tools.searchCode)
 *   .build();
 * ```
 */
export function createProjectTools(projectId: string): {
  listFiles: AnyTool;
  readFile: AnyTool;
  searchCode: AnyTool;
} {
  // -------------------------------------------------------------------------
  // list_files — list files and directories in the project
  // -------------------------------------------------------------------------

  const listFiles = createTool({
    name: "list_files",
    description: "List files and directories in the project.",
    input: z.object({
      path: z
        .string()
        .default(".")
        .describe("Relative path within the project. Use '.' for root."),
      recursive: z
        .boolean()
        .default(false)
        .describe("Whether to list recursively. Defaults to false."),
    }),
    execute: async ({ path, recursive }) => {
      // For root listing, find nodes with no parent (top-level).
      // For non-root, find nodes whose path starts with the given prefix.
      const isRoot = path === "." || path === "" || path === "/";

      const where: Record<string, unknown> = { projectId };

      if (recursive) {
        // Recursive: return all files, optionally filtered by path prefix.
        if (!isRoot) {
          // Normalize path: strip trailing slash for prefix matching.
          const prefix = path.replace(/\/+$/, "");
          where.path = { startsWith: `${prefix}/` };
        }
      } else {
        // Non-recursive: only direct children.
        if (isRoot) {
          where.parentId = null;
        } else {
          // Find the parent node first, then list its children.
          const parentNode = await prisma.fileNode.findFirst({
            where: { projectId, path, type: "FOLDER" },
            select: { id: true },
          });
          if (!parentNode) {
            return { error: `Directory not found: ${path}`, files: [] };
          }
          where.parentId = parentNode.id;
        }
      }

      const nodes = await prisma.fileNode.findMany({
        where,
        select: {
          path: true,
          type: true,
          name: true,
          size: true,
          language: true,
        },
        orderBy: [{ type: "asc" }, { name: "asc" }],
        take: MAX_LIST_RESULTS,
      });

      return nodes.map((n) => ({
        path: n.path,
        name: n.name,
        type: n.type,
        size: n.size,
        ...(n.language ? { language: n.language } : {}),
      }));
    },
  });

  // -------------------------------------------------------------------------
  // read_file — read file contents from the database
  // -------------------------------------------------------------------------

  const readFile = createTool({
    name: "read_file",
    description:
      "Read the contents of a file. Returns the file content as text.",
    input: z.object({
      path: z
        .string()
        .describe("Relative file path within the project"),
    }),
    execute: async ({ path }) => {
      const node = await prisma.fileNode.findFirst({
        where: { projectId, path, type: "FILE" },
        select: { content: true, path: true, size: true, language: true },
      });

      if (!node) {
        return { error: `File not found: ${path}` };
      }

      const content = node.content ?? "";
      const truncated = content.length > MAX_FILE_CONTENT;

      return {
        path: node.path,
        content: truncated ? content.slice(0, MAX_FILE_CONTENT) : content,
        size: node.size,
        ...(node.language ? { language: node.language } : {}),
        ...(truncated
          ? {
              truncated: true,
              totalLength: content.length,
              note: `Content truncated to ${MAX_FILE_CONTENT} characters. Full file is ${content.length} characters.`,
            }
          : {}),
      };
    },
  });

  // -------------------------------------------------------------------------
  // search_code — search for text in project files
  // -------------------------------------------------------------------------

  const searchCode = createTool({
    name: "search_code",
    description:
      "Search for text in project files. Returns matching files with line-level matches.",
    input: z.object({
      query: z
        .string()
        .describe("Text to search for in file contents"),
      maxResults: z
        .number()
        .default(20)
        .describe("Maximum number of files to return (default: 20)"),
    }),
    execute: async ({ query, maxResults }) => {
      const limit = Math.min(maxResults, MAX_SEARCH_RESULTS);

      // Use Prisma's `contains` for text search. This mirrors the approach
      // in runner.ts's searchCode function but uses the database directly
      // rather than the search engine, making it self-contained.
      const files = await prisma.fileNode.findMany({
        where: {
          projectId,
          type: "FILE",
          content: { contains: query },
        },
        select: { path: true, content: true, language: true },
        take: limit,
      });

      return files.map((f) => {
        const lines = (f.content ?? "").split("\n");
        const matches = lines
          .map((line, i) => ({ line: i + 1, text: line.trimEnd() }))
          .filter((l) => l.text.includes(query));

        // Limit matches per file to avoid huge payloads
        const cappedMatches = matches.slice(0, 10);

        return {
          path: f.path,
          ...(f.language ? { language: f.language } : {}),
          matchCount: matches.length,
          matches: cappedMatches,
          ...(matches.length > cappedMatches.length
            ? {
                note: `Showing ${cappedMatches.length} of ${matches.length} matches in this file.`,
              }
            : {}),
        };
      });
    },
  });

  return { listFiles, readFile, searchCode };
}
