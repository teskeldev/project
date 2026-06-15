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
  isAIConfiguredAsync,
  type AIMessage,
} from "@/lib/ai/provider";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  compactThreadIfNeeded,
  getEffectiveMessages,
} from "@/lib/ai/compaction";
import { detectRelevantFiles } from "@/lib/ai/auto-context";
import { checkQuota, recordUsage } from "@/lib/quota";

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// POST /api/ai/chat/stream
// Body: { threadId, content, selectedPaths?, model?, provider?, useQualityEngine?, qualityLevel? }
// Streams the assistant reply as text/event-stream, then persists it.
export async function POST(req: Request) {
  try {
    const body = await validateBody(req, chatStreamSchema);
    const { threadId, content, selectedPaths, model, provider, fusionId, useQualityEngine, qualityLevel } = body;

    // OPTIONAL idempotency: if the client supplies an Idempotency-Key header
    // and a USER message with that key already exists in this thread, skip
    // re-persisting the user message. This makes the endpoint safe to retry
    // on transient network errors without producing duplicate USER rows.
    // Note: this is best-effort (uses the existing ChatMessage.metadata JSON
    // column rather than a dedicated index/unique constraint) because
    // adding a new model + migration is out of scope here. The "return the
    // prior assistant content as SSE" fast-path is not implemented yet; the
    // request still re-runs the model so client behavior is identical.
    const idempotencyKey = req.headers.get("Idempotency-Key")?.trim() || null;
    let idempotencyReplay = false;
    if (idempotencyKey) {
      const prior = await prisma.chatMessage.findFirst({
        where: {
          threadId,
          role: "USER",
          metadata: { path: ["idempotencyKey"], equals: idempotencyKey },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (prior) {
        idempotencyReplay = true;
      }
    }

    const thread = await prisma.chatThread.findUnique({
      where: { id: threadId },
      select: { id: true, projectId: true },
    });
    if (!thread) {
      throw new ApiError("Thread not found", 404, "NOT_FOUND");
    }

    const { user, project, member } = await requireProjectAccess(thread.projectId);
    const projectId = thread.projectId;
    const workspaceId = project!.workspaceId;

    // Rate limit AI usage per user (20/min). Production should use Redis.
    await enforceRateLimit(`ai:chat:${user.id}`, 20, 60_000);

    // Quota check: reserve ~1000 tokens for this chat turn.
    await checkQuota(workspaceId, "ai_tokens", 1000);

    if (!(await isAIConfiguredAsync(undefined, workspaceId))) {
      return apiError(
        "AI is not configured. Add an OpenAI key in Integrations to enable chat.",
        503,
        "AI_NOT_CONFIGURED"
      );
    }

    // Persist the user's message before generating a reply. If an
    // Idempotency-Key was supplied and a prior USER message with the same
    // key already exists, skip the duplicate insert (and log a warning).
    // The full "return the prior assistant text as SSE" path is left as a
    // future enhancement; for now we re-run the model so client behavior
    // stays identical.
    if (idempotencyReplay) {
      console.warn(
        `[ai/chat/stream] Idempotency-Key ${idempotencyKey} already used for thread ${threadId}; skipping duplicate USER message persistence`
      );
    } else {
      await prisma.chatMessage.create({
        data: {
          threadId,
          role: "USER",
          content,
          ...(idempotencyKey
            ? { metadata: { idempotencyKey } }
            : {}),
        },
      });
    }

    // ─── Fusion path: run a saved Fusion (AI Team) for this turn ───────────────
    if (fusionId) {
      const { runFusion } = await import("@/lib/ai/fusion/runner");
      const result = await runFusion({
        fusionId,
        prompt: content,
        workspaceId,
        projectId,
        signal: req.signal,
      });

      await prisma.chatMessage.create({
        data: {
          threadId,
          role: "ASSISTANT",
          content: result.fused,
          metadata: {
            fusion: true,
            fusionId,
            judgeUsed: result.judgeUsed,
            runs: result.runs.map((r) => ({ modelId: r.modelId, provider: r.provider, ok: r.ok, latencyMs: r.latencyMs })),
            metrics: result.metrics,
            warnings: result.warnings,
          },
        },
      });
      await prisma.chatThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              sse("fusion-result", {
                output: result.fused,
                runs: result.runs,
                judgeUsed: result.judgeUsed,
                warnings: result.warnings,
                metrics: result.metrics,
              })
            )
          );
          controller.enqueue(encoder.encode(sse("done", { ok: true })));
          controller.close();
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
    }

    // If quality engine is requested, use it instead of direct streaming
    if (useQualityEngine) {
      const { runQualityEngine } = await import("@/lib/ai/quality-engine");
      const result = await runQualityEngine({
        task: content,
        projectId,
        storageKey: project!.storageKey,
        modelId: model,
        provider,
        workspaceId: member.workspaceId,
        qualityLevel: qualityLevel || "balanced",
        selectedPaths,
        signal: req.signal,
      });

      // Persist the assistant reply
      await prisma.chatMessage.create({
        data: {
          threadId,
          role: "ASSISTANT",
          content: result.output,
          metadata: {
            qualityEngine: true,
            qualityScore: result.quality.score,
            qualityGrade: result.quality.grade,
            pipelineUsed: result.metadata.pipelineUsed,
          },
        },
      });
      await prisma.chatThread.update({
        where: { id: threadId },
        data: { updatedAt: new Date() },
      });

      // Return as a single SSE stream with the full result
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              sse("quality-result", {
                output: result.output,
                patches: result.patches,
                quality: result.quality,
                metadata: result.metadata,
                contextUsed: result.contextUsed,
                warnings: result.warnings,
              })
            )
          );
          controller.enqueue(encoder.encode(sse("done", { ok: true })));
          controller.close();
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
    }

    // ─── Standard streaming path (existing behavior) ───────────────────────────

    // Check if compaction is needed and perform it before building context.
    const compactionResult = await compactThreadIfNeeded(threadId, {
      workspaceId,
    });

    // Smart auto-context: if no selectedPaths provided, detect relevant files
    let effectivePaths = selectedPaths;
    let autoDetectedPaths: string[] | null = null;

    if (!effectivePaths || effectivePaths.length === 0) {
      autoDetectedPaths = await detectRelevantFiles(thread.projectId, content);
      if (autoDetectedPaths.length > 0) {
        effectivePaths = autoDetectedPaths;
      }
    }

    // Build the system context (persona + project + rules + selected files).
    const { system } = await buildProjectContext(thread.projectId, {
      selectedPaths: effectivePaths,
    });

    // Use effective messages (includes compaction summary if it occurred).
    const effectiveHistory = await getEffectiveMessages(threadId);

    const messages: AIMessage[] = [
      { role: "system", content: system },
      ...effectiveHistory.filter((m) => m.role !== "system"),
    ];

    // Honor client disconnects via the request signal.
    const upstreamSignal = req.signal;

    const encoder = new TextEncoder();
    let assistantText = "";

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          // If compaction occurred, notify the client.
          if (compactionResult) {
            controller.enqueue(
              encoder.encode(
                sse("compaction", {
                  message: `[Context compacted: ${compactionResult.compactedCount} messages summarized]`,
                  compactedCount: compactionResult.compactedCount,
                  remainingCount: compactionResult.remainingCount,
                })
              )
            );
          }

          // If auto-context detected files, notify the client.
          if (autoDetectedPaths && autoDetectedPaths.length > 0) {
            controller.enqueue(
              encoder.encode(
                sse("auto-context", {
                  message: `Auto-included: ${autoDetectedPaths.join(", ")}`,
                  paths: autoDetectedPaths,
                })
              )
            );
          }

          for await (const delta of streamChat(messages, {
            model,
            signal: upstreamSignal,
            workspaceId,
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
            // Record actual token usage after completion.
            // Rough heuristic: ~4 chars per token, includes input+output.
            const inputEstimate = messages.reduce((s, m) => s + m.content.length, 0);
            const actualTokens = Math.max(1, Math.ceil((inputEstimate + assistantText.length) / 4));
            await recordUsage(workspaceId, "ai_tokens", actualTokens, {
              source: "chat/stream",
              threadId,
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
