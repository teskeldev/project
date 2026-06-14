import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  handleApiError,
  requireProjectAccess,
  validateBody,
  ApiError,
} from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isAIConfiguredAsync, streamChat, type AIMessage } from "@/lib/ai/provider";

const generateSchema = z.object({
  sessionId: z.string().min(1),
  prompt: z.string().min(1).max(10000),
});

const SYSTEM_PROMPT =
  "You are Teskel Design AI. Generate a single React component using Tailwind CSS based on the user's description. Return ONLY the JSX/TSX code, no explanation, no markdown fences. The component should be self-contained and render correctly.";

/**
 * POST /api/design/generate
 * Streaming endpoint for AI design generation.
 * Wire format (SSE):
 *   event: delta\ndata: {"content":"..."}\n\n
 *   event: done\ndata: {"versionId":"..."}\n\n
 *   event: error\ndata: {"message":"..."}\n\n
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const body = await validateBody(req, generateSchema);

    // Verify session exists and user has access
    const session = await prisma.designSession.findUnique({
      where: { id: body.sessionId },
      include: {
        versions: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { code: true, prompt: true },
        },
      },
    });

    if (!session) {
      throw new ApiError("Session not found", 404, "NOT_FOUND");
    }

    const { user, member } = await requireProjectAccess(session.projectId);

    // Rate limit: 10 per user per minute
    await enforceRateLimit(`design:generate:${user.id}`, 10, 60_000);

    if (!await isAIConfiguredAsync(undefined, member.workspaceId)) {
      throw new ApiError(
        "AI is not configured. Add an OpenAI API key in Integrations to enable design generation.",
        503,
        "AI_NOT_CONFIGURED"
      );
    }

    // Build messages with context from previous versions
    const messages: AIMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];

    // Add recent history for context (oldest first)
    const recentVersions = [...session.versions].reverse();
    for (const v of recentVersions) {
      messages.push({ role: "user", content: v.prompt });
      messages.push({ role: "assistant", content: v.code });
    }

    messages.push({ role: "user", content: body.prompt });

    // Create a streaming response
    const encoder = new TextEncoder();
    let fullContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: Record<string, unknown>) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          for await (const delta of streamChat(messages)) {
            fullContent += delta;
            sendEvent("delta", { content: delta });
          }

          // Persist the version
          const version = await prisma.designVersion.create({
            data: {
              sessionId: body.sessionId,
              code: fullContent,
              prompt: body.prompt,
            },
          });

          // Update session timestamp
          await prisma.designSession.update({
            where: { id: body.sessionId },
            data: { updatedAt: new Date() },
          });

          sendEvent("done", { versionId: version.id });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Generation failed";
          sendEvent("error", { message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
