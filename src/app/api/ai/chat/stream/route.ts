import { prisma } from "@/lib/db";
import {
  handleApiError,
  requireProjectAccess,
  validateBody,
  apiError,
  ApiError,
} from "@/lib/api";
import { chatStreamSchema } from "@/lib/validators";
import { buildProjectContext } from "@/lib/ai/context";
import {
  streamChat,
  isAIConfigured,
  type AIMessage,
} from "@/lib/ai/provider";
import { enforceRateLimit } from "@/lib/rate-limit";

// Map our DB MessageRole values to provider ChatRole.
function toChatRole(role: string): AIMessage["role"] {
  switch (role) {
    case "USER":
      return "user";
    case "ASSISTANT":
      return "assistant";
    case "TOOL":
      return "tool";
    default:
      return "system";
  }
}

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// POST /api/ai/chat/stream
// Body: { threadId, content, selectedPaths? }
// Streams the assistant reply as text/event-stream, then persists it.
export async function POST(req: Request) {
  try {
    const { threadId, content, selectedPaths } = await validateBody(
      req,
      chatStreamSchema
    );

    const thread = await prisma.chatThread.findUnique({
      where: { id: threadId },
      select: { id: true, projectId: true },
    });
    if (!thread) {
      throw new ApiError("Thread not found", 404, "NOT_FOUND");
    }

    const { user } = await requireProjectAccess(thread.projectId);

    // Rate limit AI usage per user (20/min). Production should use Redis.
    enforceRateLimit(`ai:chat:${user.id}`, 20, 60_000);

    if (!isAIConfigured()) {
      return apiError(
        "AI is not configured. Add an OpenAI key in Integrations to enable chat.",
        503,
        "AI_NOT_CONFIGURED"
      );
    }

    // Persist the user's message before generating a reply.
    await prisma.chatMessage.create({
      data: { threadId, role: "USER", content },
    });

    // Build the system context (persona + project + rules + selected files).
    const { system } = await buildProjectContext(thread.projectId, {
      selectedPaths,
    });

    // Prior thread messages (oldest first) become conversation history. The
    // just-persisted user message is included by this query.
    const history = await prisma.chatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true },
    });

    const messages: AIMessage[] = [
      { role: "system", content: system },
      ...history
        .filter((m) => m.role !== "SYSTEM")
        .map((m) => ({ role: toChatRole(m.role), content: m.content })),
    ];

    // Honor client disconnects via the request signal.
    const upstreamSignal = req.signal;

    const encoder = new TextEncoder();
    let assistantText = "";

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const delta of streamChat(messages, {
            signal: upstreamSignal,
          })) {
            assistantText += delta;
            controller.enqueue(encoder.encode(sse("delta", { content: delta })));
          }

          // Persist the full assistant reply on successful completion.
          if (assistantText.length > 0) {
            await prisma.chatMessage.create({
              data: {
                threadId,
                role: "ASSISTANT",
                content: assistantText,
              },
            });
            await prisma.chatThread.update({
              where: { id: threadId },
              data: { updatedAt: new Date() },
            });
          }

          controller.enqueue(encoder.encode(sse("done", { ok: true })));
          controller.close();
        } catch (err) {
          // Client abort: persist whatever we collected, then stop quietly.
          const aborted =
            upstreamSignal.aborted ||
            (err instanceof Error && err.name === "AbortError");

          if (assistantText.length > 0) {
            try {
              await prisma.chatMessage.create({
                data: {
                  threadId,
                  role: "ASSISTANT",
                  content: assistantText,
                  metadata: aborted ? { aborted: true } : undefined,
                },
              });
            } catch {
              // best-effort persistence
            }
          }

          if (!aborted) {
            const message =
              err instanceof ApiError
                ? err.message
                : "The AI provider returned an error.";
            try {
              controller.enqueue(
                encoder.encode(sse("error", { message }))
              );
            } catch {
              // controller may already be closed
            }
          }

          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      },
      cancel() {
        // Reader was cancelled (client went away). streamChat observes the
        // same upstreamSignal, so nothing else to do here.
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
