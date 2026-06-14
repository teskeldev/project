import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  requireProjectAccess,
  validateBody,
  ApiError,
} from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { checkQuota, recordUsage } from "@/lib/quota";
import { chat, isAIConfiguredAsync } from "@/lib/ai/provider";
import type { AIMessage } from "@/lib/ai/provider";

const reviewRequestSchema = z.object({
  changeSetId: z.string(),
  instructions: z.string().max(8000).optional(),
});

// POST /api/ai/review
// Body: { changeSetId }
// Reads the changeset file changes, asks AI to review, persists ReviewComment rows.
export async function POST(req: Request) {
  try {
    const user = await requireUser();

    // Rate limit: 10 per user per minute
    await enforceRateLimit(`ai:review:${user.id}`, 10, 60_000);

    const { changeSetId, instructions } = await validateBody(req, reviewRequestSchema);

    const changeSet = await prisma.changeSet.findUnique({
      where: { id: changeSetId },
      include: {
        fileChanges: {
          select: { filePath: true, changeType: true, diff: true, newContent: true },
        },
      },
    });

    if (!changeSet) {
      throw new ApiError("Changeset not found", 404, "NOT_FOUND");
    }

    const { member } = await requireProjectAccess(changeSet.projectId);

    // Quota check: reserve ~1500 tokens for a code review.
    await checkQuota(member.workspaceId, "ai_tokens", 1500);

    if (!await isAIConfiguredAsync(undefined, member.workspaceId)) {
      throw new ApiError(
        "AI is not configured. Add an OpenAI API key to enable reviews.",
        503,
        "AI_NOT_CONFIGURED"
      );
    }

    // Build context for AI
    const diffContext = changeSet.fileChanges
      .map((fc) => {
        const diffText = fc.diff || "(no diff available)";
        return `### ${fc.filePath} (${fc.changeType})\n\`\`\`diff\n${diffText}\n\`\`\``;
      })
      .join("\n\n");

    const systemPrompt = `You are a senior code reviewer for the Teskel platform. Review these code changes. For each issue found, provide the file path, line number, a brief comment, and optionally a code suggestion.

Respond ONLY with a JSON array of objects with this shape:
[
  {
    "filePath": "path/to/file.ts",
    "line": 15,
    "content": "Brief explanation of the issue or improvement",
    "suggestion": "optional code suggestion or null"
  }
]

If there are no issues, return an empty array []. Do not include any text outside the JSON array.`;

    const messages: AIMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Please review the following changes:\n\n${diffContext}${instructions ? `\n\nAdditional instructions: ${instructions}` : ""}` },
    ];

    const response = await chat(messages, { temperature: 0.3 });

    // Record AI token usage for the review.
    const inputChars = messages.reduce((s, m) => s + m.content.length, 0);
    const actualTokens = Math.max(1, Math.ceil((inputChars + response.length) / 4));
    await recordUsage(member.workspaceId, "ai_tokens", actualTokens, {
      source: "ai/review",
      changeSetId,
    });

    // Parse AI response
    let reviewItems: Array<{
      filePath: string;
      line: number;
      content: string;
      suggestion?: string | null;
    }> = [];

    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = response.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      reviewItems = JSON.parse(jsonStr);
      if (!Array.isArray(reviewItems)) {
        reviewItems = [];
      }
    } catch {
      // If AI response isn't valid JSON, create a single generic comment
      reviewItems = [];
    }

    // Persist comments
    const created = await prisma.$transaction(
      reviewItems.map((item) =>
        prisma.reviewComment.create({
          data: {
            changeSetId,
            filePath: item.filePath,
            line: item.line ?? 1,
            author: "Teskel AI",
            content: item.content,
            suggestion: item.suggestion || null,
            resolved: false,
          },
        })
      )
    );

    const comments = created.map((c) => ({
      id: c.id,
      changeSetId: c.changeSetId,
      filePath: c.filePath,
      line: c.line,
      author: c.author,
      content: c.content,
      suggestion: c.suggestion,
      resolved: c.resolved,
      createdAt: c.createdAt.toISOString(),
    }));

    return apiSuccess({ comments });
  } catch (err) {
    return handleApiError(err);
  }
}

// GET /api/ai/review?changeSetId=xxx
// Returns existing review comments for a changeset.
export async function GET(req: Request) {
  try {
    await requireUser();

    const url = new URL(req.url);
    const changeSetId = url.searchParams.get("changeSetId");

    if (!changeSetId) {
      throw new ApiError("changeSetId query param is required", 400, "MISSING_FIELD");
    }

    const changeSet = await prisma.changeSet.findUnique({
      where: { id: changeSetId },
      select: { projectId: true },
    });

    if (!changeSet) {
      throw new ApiError("Changeset not found", 404, "NOT_FOUND");
    }

    await requireProjectAccess(changeSet.projectId);

    const rows = await prisma.reviewComment.findMany({
      where: { changeSetId },
      orderBy: { createdAt: "asc" },
    });

    const comments = rows.map((c) => ({
      id: c.id,
      changeSetId: c.changeSetId,
      filePath: c.filePath,
      line: c.line,
      author: c.author,
      content: c.content,
      suggestion: c.suggestion,
      resolved: c.resolved,
      createdAt: c.createdAt.toISOString(),
    }));

    return apiSuccess({ comments });
  } catch (err) {
    return handleApiError(err);
  }
}
