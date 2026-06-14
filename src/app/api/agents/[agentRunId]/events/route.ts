import { prisma } from "@/lib/db";
import { handleApiError, requireProjectAccess, ApiError } from "@/lib/api";
import {
  driveAgentRun,
  subscribe,
  type AgentEvent,
} from "@/lib/agents/runner";
import { isQueueEnabled } from "@/lib/queue/connection";

type RouteContext = { params: Promise<{ agentRunId: string }> };

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}

/**
 * GET /api/agents/:agentRunId/events  (SSE)
 *
 * Execution-driving model:
 *  - The POST create endpoint persisted a QUEUED run (no work done yet).
 *  - Opening this stream subscribes to live events AND triggers
 *    `driveAgentRun()`, so the steps actually execute within this request's
 *    lifecycle while progress is streamed.
 *  - If the run is already RUNNING (another open stream is driving it) the
 *    subscription simply receives that run's live events.
 *  - If the run is already terminal (COMPLETED/FAILED/CANCELLED) or
 *    WAITING_APPROVAL, we replay a single status event from the DB and close --
 *    no re-execution. This makes reconnects safe.
 *
 * The stream ends when the run reaches a terminal/waiting state, the client
 * disconnects, or the request is aborted.
 */
export async function GET(req: Request, ctx: RouteContext) {
  try {
    const { agentRunId } = await ctx.params;

    const run = await prisma.agentRun.findUnique({
      where: { id: agentRunId },
      select: { projectId: true, status: true, error: true },
    });
    if (!run) {
      throw new ApiError("Agent run not found", 404, "NOT_FOUND");
    }

    await requireProjectAccess(run.projectId);

    const encoder = new TextEncoder();
    const upstreamSignal = req.signal;

    // For an already-finished run, replay status once and close.
    const isTerminal =
      run.status === "COMPLETED" ||
      run.status === "FAILED" ||
      run.status === "CANCELLED" ||
      run.status === "WAITING_APPROVAL";

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const safeEnqueue = (s: string) => {
          try {
            controller.enqueue(encoder.encode(s));
          } catch {
            /* controller already closed */
          }
        };

        // Always announce the current status first so reconnecting clients sync.
        safeEnqueue(sse("status", { status: run.status }));

        if (isTerminal) {
          if (run.status === "WAITING_APPROVAL") {
            const cs = await prisma.changeSet.findFirst({
              where: { agentRunId },
              select: { id: true },
            });
            safeEnqueue(
              sse("waiting_approval", { changeSetId: cs?.id ?? null })
            );
          } else if (run.status === "FAILED") {
            safeEnqueue(
              sse("failed", { error: run.error ?? "Agent run failed" })
            );
          } else if (run.status === "CANCELLED") {
            safeEnqueue(sse("cancelled", {}));
          } else {
            safeEnqueue(sse("completed", {}));
          }
          safeEnqueue(sse("end", {}));
          try {
            controller.close();
          } catch {
            /* ignore */
          }
          return;
        }

        // Live run: subscribe, then (if QUEUED) trigger execution.
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          unsubscribe();
          safeEnqueue(sse("end", {}));
          try {
            controller.close();
          } catch {
            /* ignore */
          }
        };

        const onEvent = (event: AgentEvent) => {
          safeEnqueue(sse(event.type, event));
          if (
            event.type === "completed" ||
            event.type === "failed" ||
            event.type === "cancelled" ||
            event.type === "waiting_approval"
          ) {
            finish();
          }
        };

        const unsubscribe = subscribe(agentRunId, onEvent);

        // If the client goes away mid-run, stop streaming (the run continues in
        // process; a reconnect will replay current status).
        upstreamSignal.addEventListener("abort", () => finish());

        // In QUEUE MODE a BullMQ worker drives the run in a separate process;
        // here we only stream the events it publishes over the bus. In FALLBACK
        // MODE (no Redis) drive the run in-process on first connect. The atomic
        // QUEUED->RUNNING claim inside driveAgentRun makes concurrent opens
        // (and a worker racing this path) safe either way.
        if (!isQueueEnabled()) {
          void driveAgentRun(agentRunId).catch(() => {
            // Failures are surfaced via the failed event; nothing to do here.
          });
        }
      },
      cancel() {
        // Reader cancelled (client disconnected). The abort listener handles
        // cleanup; the run keeps progressing in-process.
      },
    });

    return new Response(stream, { headers: sseHeaders() });
  } catch (err) {
    return handleApiError(err);
  }
}
