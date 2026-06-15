import { handleApiError, requireWorkspaceAccess, requireRole, validateBody, apiError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { playgroundRun } from "@/lib/ai/fusion/schemas";
import { runFusion } from "@/lib/ai/fusion/runner";

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// POST /api/fusion/playground — run a saved Fusion against a prompt, streaming
// live progress (model_start / model_done / judging) then the final result.
export async function POST(req: Request) {
  try {
    const { workspaceId, fusionId, prompt } = await validateBody(req, playgroundRun);
    const { user, member } = await requireWorkspaceAccess(workspaceId);
    requireRole(member);
    await enforceRateLimit(`fusion:playground:${user.id}`, 10, 60_000);

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          try {
            controller.enqueue(encoder.encode(sse(event, data)));
          } catch {
            /* controller closed */
          }
        };
        try {
          const result = await runFusion({
            fusionId,
            prompt,
            workspaceId,
            signal: req.signal,
            onProgress: (ev) => send(ev.type, ev),
          });
          send("result", { result });
          send("done", { ok: true });
        } catch (err) {
          send("error", { message: err instanceof Error ? err.message : "Fusion run failed" });
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
    // Auth/validation/rate-limit failures (before streaming) → JSON error.
    if (err instanceof Error && err.message) return handleApiError(err);
    return apiError("Fusion run failed", 500, "INTERNAL_ERROR");
  }
}
