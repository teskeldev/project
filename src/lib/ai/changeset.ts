/**
 * Teskel structured change proposal contract.
 *
 * SERVER-ONLY: reads the DB + filesystem and persists ChangeSet/FileChange rows.
 *
 * The AI proposes changes as strict JSON matching `ProposedChangeSchema`. We
 * validate, enrich UPDATE/DELETE entries with current file content + a unified
 * diff, then PERSIST a ChangeSet (PENDING_REVIEW) and its FileChange rows
 * (PENDING). Applying changes to disk is Phase 4 - this module never writes
 * project files.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { readFile } from "@/lib/storage";
import { buildProjectContext } from "@/lib/ai/context";
import { chat, type AIMessage, type ChatOptions } from "@/lib/ai/provider";

export const ProposedFileChangeSchema = z.object({
  filePath: z.string().min(1),
  changeType: z.enum(["CREATE", "UPDATE", "DELETE", "RENAME"]),
  newContent: z.string().optional(),
  oldPath: z.string().optional(),
});
export type ProposedFileChange = z.infer<typeof ProposedFileChangeSchema>;

export const ProposedChangeSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  changes: z.array(ProposedFileChangeSchema).min(1),
});
export type ProposedChange = z.infer<typeof ProposedChangeSchema>;

/**
 * Minimal unified-diff generator (LCS-based). Avoids adding a dependency.
 * Produces a `diff --git`-free, `---`/`+++` headed hunk-less line diff that is
 * good enough for review display; Phase 4 can swap in a richer differ.
 *
 * To avoid runaway memory from very large inputs (the LCS table is O(m*n)
 * 32-bit ints), we cap each input at 10_000 lines. The 2000-line cap used
 * by `src/lib/diff.ts` for the side-by-side view is meant for interactive
 * display; the changeset diff is a different use case (a record persisted
 * with the proposal) and is allowed up to 5x that size.
 */
const MAX_UNIFIED_DIFF_LINES = 10_000;

export function unifiedDiff(
  oldText: string,
  newText: string,
  filePath: string
): string {
  const a = oldText.split("\n");
  const b = newText.split("\n");

  // Size guard: refuse to allocate an O(m*n) LCS table for huge inputs.
  if (a.length > MAX_UNIFIED_DIFF_LINES || b.length > MAX_UNIFIED_DIFF_LINES) {
    throw new ApiError(
      `unifiedDiff input too large (${a.length} vs ${b.length} lines, max ${MAX_UNIFIED_DIFF_LINES})`,
      413,
      "DIFF_TOO_LARGE"
    );
  }

  // LCS table.
  const m = a.length;
  const n = b.length;
  const lcs: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const lines: string[] = [`--- a/${filePath}`, `+++ b/${filePath}`];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      lines.push(` ${a[i]}`);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      lines.push(`-${a[i]}`);
      i++;
    } else {
      lines.push(`+${b[j]}`);
      j++;
    }
  }
  while (i < m) {
    lines.push(`-${a[i]}`);
    i++;
  }
  while (j < n) {
    lines.push(`+${b[j]}`);
    j++;
  }
  return lines.join("\n");
}

/** Strip ```json ... ``` (or ``` ... ```) fences and surrounding prose. */
function extractJson(raw: string): string {
  let text = raw.trim();

  // Remove leading/trailing markdown code fences if present.
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  // If there is still surrounding prose, isolate the outermost JSON object.
  if (!text.startsWith("{")) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      text = text.slice(start, end + 1);
    }
  }
  return text;
}

const CHANGESET_INSTRUCTION = [
  "You must respond with ONLY a single JSON object and nothing else.",
  "Do not include markdown code fences, commentary, or explanation.",
  "The JSON MUST match this TypeScript type exactly:",
  "{",
  '  "title": string,',
  '  "description"?: string,',
  '  "changes": Array<{',
  '    "filePath": string,',
  '    "changeType": "CREATE" | "UPDATE" | "DELETE" | "RENAME",',
  '    "newContent"?: string,  // required for CREATE/UPDATE; full file content',
  '    "oldPath"?: string      // required for RENAME (the original path)',
  "  }>",
  "}",
  "For UPDATE provide the COMPLETE new file content in newContent.",
  "For DELETE omit newContent. For RENAME set oldPath to the current path and",
  "filePath to the new path.",
].join("\n");

export type GenerateChangeSetOptions = {
  selectedPaths?: string[];
  /** Forwarded to the provider (model/temperature). Defaults to temp 0.1. */
  ai?: ChatOptions;
};

/**
 * Ask the AI for a structured changeset, validate it, enrich with current
 * content + diffs, and persist a PENDING_REVIEW ChangeSet with PENDING
 * FileChange rows. Does NOT apply changes to disk (Phase 4).
 */
export async function generateChangeSet(
  projectId: string,
  instruction: string,
  opts?: GenerateChangeSetOptions
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { storageKey: true },
  });
  if (!project) {
    throw new ApiError("Project not found", 404, "NOT_FOUND");
  }

  const { system } = await buildProjectContext(projectId, {
    selectedPaths: opts?.selectedPaths,
  });

  const messages: AIMessage[] = [
    { role: "system", content: system },
    { role: "system", content: CHANGESET_INSTRUCTION },
    {
      role: "user",
      content: `Produce a changeset for the following instruction:\n\n${instruction}`,
    },
  ];

  const raw = await chat(messages, {
    temperature: 0.1,
    ...opts?.ai,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    throw new ApiError(
      "The AI returned an unparseable changeset.",
      502,
      "AI_INVALID_OUTPUT"
    );
  }

  const result = ProposedChangeSchema.safeParse(parsed);
  if (!result.success) {
    throw new ApiError(
      "The AI changeset did not match the expected schema.",
      502,
      "AI_INVALID_OUTPUT",
      result.error.flatten()
    );
  }
  const proposal = result.data;

  // Enrich each change with current content + diff (read-only).
  const fileChangeData = await Promise.all(
    proposal.changes.map(async (c) => {
      let oldContent: string | null = null;
      let diff: string | null = null;

      const readPath = c.changeType === "RENAME" ? c.oldPath ?? c.filePath : c.filePath;

      if (c.changeType === "UPDATE" || c.changeType === "DELETE" || c.changeType === "RENAME") {
        try {
          oldContent = await readFile(project.storageKey, readPath);
        } catch {
          oldContent = null;
        }
      }

      if (c.changeType === "UPDATE") {
        diff = unifiedDiff(oldContent ?? "", c.newContent ?? "", c.filePath);
      } else if (c.changeType === "CREATE") {
        diff = unifiedDiff("", c.newContent ?? "", c.filePath);
      } else if (c.changeType === "DELETE") {
        diff = unifiedDiff(oldContent ?? "", "", c.filePath);
      }

      return {
        filePath: c.filePath,
        oldPath: c.changeType === "RENAME" ? c.oldPath ?? null : null,
        changeType: c.changeType,
        oldContent,
        newContent: c.newContent ?? null,
        diff,
        status: "PENDING" as const,
      };
    })
  );

  const changeSet = await prisma.changeSet.create({
    data: {
      projectId,
      title: proposal.title,
      description: proposal.description ?? null,
      status: "PENDING_REVIEW",
      fileChanges: { create: fileChangeData },
    },
    include: { fileChanges: true },
  });

  return changeSet;
}
