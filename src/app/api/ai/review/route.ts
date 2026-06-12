import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  requireProjectAccess,
  ApiError,
} from "@/lib/api";
import { chat, isAIConfigured } from "@/lib/ai/provider";
import type { AIMessage } from "@/lib/ai/provider";

// POST /api/ai/review
// Body: { changeSetId }
// Reads the changeset file changes, asks AI to review, persists ReviewComment rows.
export async function POST(req: Request) {
  try {
    await requireUser();

    let body: { changeSetId?: string };
    try {
      body = (await req.json()) as { changeSetId?: string };
    } catch {
      throw new ApiError("Invalid JSON body", 400, "INVALID_JSON");
    }

    const { changeSetId } = body;
    if (!changeSetId) {
      throw new ApiError("changeSetId is required", 400, "MISSING_FIELD");
    }

    if (!isAIConfigured()) {
      throw new ApiError(
        "AI is not configured. Add an OpenAI API key to enable reviews.",
        503,
        "AI_NOT_CONFIGURED"
      );
    }

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

    await requireProjectAccess(changeSet.projectId);

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
      { role: "user", content: `Please review the following changes:\n\n${diffContext}` },
    ];

    const response = await chat(messages, { temperature: 0.3 });

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
