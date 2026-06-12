/**
 * Teskel project context builder.
 *
 * SERVER-ONLY: reads from the database and the filesystem storage layer.
 *
 * Produces the SYSTEM message used to prime the AI for a project: the Teskel
 * persona, project metadata, a capped file tree, the contents of any selected
 * files, applicable Rules, and relevant KnowledgeItems. A total character
 * budget is enforced, preferring rules + selected files over the raw tree.
 */
import { prisma } from "@/lib/db";
import { readFile } from "@/lib/storage";

/** The fixed Teskel persona prepended to every system prompt. */
export const TESKEL_PERSONA = [
  "You are Teskel, an AI coding agent. Read the provided project context.",
  "Answer technically and concisely. When the user asks for code changes,",
  "produce a clear PLAN and, when appropriate, a structured set of proposed",
  "file changes (do NOT claim files are changed - changes require user approval",
  "via the Composer). Never run destructive commands. Never delete files",
  "without approval.",
].join(" ");

export type BuildContextOptions = {
  selectedPaths?: string[];
  maxChars?: number;
};

export type ContextBlock = {
  label: string;
  content: string;
};

export type ProjectContext = {
  system: string;
  contextBlocks: ContextBlock[];
};

const DEFAULT_MAX_CHARS = 12_000;
const MAX_TREE_PATHS = 400;
const MAX_PER_FILE_CHARS = 4_000;
const MAX_KNOWLEDGE_ITEMS = 20;

/** Truncate text to a max length, appending a short marker when cut. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 20)) + "\n... [truncated]";
}

/**
 * Build the project context system prompt.
 *
 * Budget strategy (highest priority first): persona -> rules -> selected file
 * contents -> knowledge -> file tree. Lower-priority sections are dropped or
 * truncated when the remaining budget runs out.
 */
export async function buildProjectContext(
  projectId: string,
  opts?: BuildContextOptions
): Promise<ProjectContext> {
  const maxChars = opts?.maxChars ?? DEFAULT_MAX_CHARS;
  const selectedPaths = (opts?.selectedPaths ?? []).filter(Boolean);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      name: true,
      description: true,
      storageKey: true,
      workspaceId: true,
    },
  });

  if (!project) {
    // No project context to add; return persona only.
    return { system: TESKEL_PERSONA, contextBlocks: [] };
  }

  const [rules, knowledge, fileNodes] = await Promise.all([
    prisma.rule.findMany({
      where: {
        enabled: true,
        OR: [
          { scope: "GLOBAL" },
          { scope: "WORKSPACE", workspaceId: project.workspaceId },
          { scope: "PROJECT", projectId },
        ],
      },
      select: { scope: true, title: true, content: true, filePattern: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.knowledgeItem.findMany({
      where: {
        OR: [
          { workspaceId: project.workspaceId, projectId: null },
          { projectId },
        ],
      },
      select: { title: true, type: true, content: true },
      orderBy: { createdAt: "asc" },
      take: MAX_KNOWLEDGE_ITEMS,
    }),
    prisma.fileNode.findMany({
      where: { projectId },
      select: { path: true, type: true },
      orderBy: { path: "asc" },
      take: MAX_TREE_PATHS + 1,
    }),
  ]);

  const blocks: ContextBlock[] = [];
  // Running budget shared across sections; persona is not counted against it
  // since it is always required.
  let remaining = maxChars;

  const pushBlock = (label: string, content: string) => {
    if (remaining <= 0 || !content.trim()) return;
    const clipped = clip(content, remaining);
    blocks.push({ label, content: clipped });
    remaining -= clipped.length;
  };

  // 1) Project metadata (cheap, always include).
  const meta = [
    `Project: ${project.name}`,
    project.description ? `Description: ${project.description}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  pushBlock("PROJECT", meta);

  // 2) Rules (high priority).
  if (rules.length > 0) {
    const rulesText = rules
      .map((r) => {
        const scopeTag =
          r.scope === "FILE" && r.filePattern
            ? `${r.scope}:${r.filePattern}`
            : r.scope;
        return `- [${scopeTag}] ${r.title}\n${r.content}`;
      })
      .join("\n\n");
    pushBlock("RULES", rulesText);
  }

  // 3) Selected file contents (high priority).
  if (selectedPaths.length > 0) {
    const fileSections: string[] = [];
    for (const p of selectedPaths) {
      if (remaining <= 0) break;
      try {
        const raw = await readFile(project.storageKey, p);
        const body = clip(raw, MAX_PER_FILE_CHARS);
        fileSections.push("FILE: " + p + "\n```\n" + body + "\n```");
      } catch {
        // Missing/unreadable file -> note it but keep going.
        fileSections.push(`FILE: ${p}\n[unavailable]`);
      }
    }
    pushBlock("SELECTED FILES", fileSections.join("\n\n"));
  }

  // 4) Knowledge (medium priority).
  if (knowledge.length > 0) {
    const kText = knowledge
      .map((k) => `- ${k.title} (${k.type})\n${k.content}`)
      .join("\n\n");
    pushBlock("KNOWLEDGE", kText);
  }

  // 5) File tree (lowest priority; paths only, capped).
  if (fileNodes.length > 0) {
    const capped = fileNodes.slice(0, MAX_TREE_PATHS);
    const treeText = capped
      .map((f) => (f.type === "FOLDER" ? `${f.path}/` : f.path))
      .join("\n");
    const suffix =
      fileNodes.length > MAX_TREE_PATHS ? "\n... [more files omitted]" : "";
    pushBlock("FILE TREE", treeText + suffix);
  }

  const system =
    TESKEL_PERSONA +
    "\n\n" +
    blocks.map((b) => `## ${b.label}\n${b.content}`).join("\n\n");

  return { system, contextBlocks: blocks };
}
