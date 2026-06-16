/**
 * Smart auto-context — automatically identifies relevant files
 * based on the user's message content.
 *
 * Strategies:
 * 1. Keyword extraction → file path matching
 * 2. Import/require graph traversal
 * 3. Recently edited files
 * 4. Files mentioned in the message
 */
import { prisma } from "@/lib/db";

export async function detectRelevantFiles(
  projectId: string,
  message: string,
  options?: { maxFiles?: number }
): Promise<string[]> {
  const maxFiles = options?.maxFiles ?? 5;
  const relevantPaths: { path: string; score: number }[] = [];

  // Strategy 1: Extract file paths mentioned in the message
  const pathMentions =
    message.match(
      /[\w\-./]+\.(ts|tsx|js|jsx|py|rs|go|css|html|json|md|yaml|yml|toml)/gi
    ) || [];

  // Strategy 2: Extract keywords and match against file paths
  const keywords = message
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((w) => w.length > 3);

  // Strategy 3: Query DB for matching files (recently updated first)
  const files = await prisma.fileNode.findMany({
    where: { projectId, type: "FILE" },
    select: { path: true, content: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  // Score each file based on keyword matches in path + content
  for (const file of files) {
    let score = 0;
    const pathLower = file.path.toLowerCase();

    // Direct path mention
    if (
      pathMentions.some(
        (p) => file.path.includes(p) || p.includes(file.path)
      )
    ) {
      score += 10;
    }

    // Keyword in path
    for (const kw of keywords) {
      if (pathLower.includes(kw)) score += 3;
      if (file.content?.toLowerCase().includes(kw)) score += 1;
    }

    // Recently edited bonus
    const ageMs = Date.now() - new Date(file.updatedAt).getTime();
    if (ageMs < 3600000) score += 2; // edited in last hour

    if (score > 0) relevantPaths.push({ path: file.path, score });
  }

  return relevantPaths
    .sort((a, b) => b.score - a.score)
    .slice(0, maxFiles)
    .map((r) => r.path);
}
