import { prisma } from "@/lib/db";
import {
  handleApiError,
  requireProjectAccess,
  validateBody,
  apiError,
  ApiError,
} from "@/lib/api";
import { runCommandSchema } from "@/lib/validators";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  validateCommand,
  resolveProjectCwd,
  changeDir,
  runCommand,
  tryAcquire,
  release,
} from "@/lib/terminal/runner";
import { checkQuota, recordUsage } from "@/lib/quota";

type RouteContext = { params: Promise<{ sessionId: string }> };

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Extract a `cd <target>` target if the command is a lone `cd`. */
function parseCd(command: string): string | null {
  const m = command.trim().match(/^cd(?:\s+(.*))?$/i);
  if (!m) return null;
  return (m[1] ?? "").trim();
}

// POST /api/terminal/:sessionId/run
// Body: { command }. Validates the command; if blocked, persists a 126 row and
// returns apiError(400, "BLOCKED_COMMAND"). Otherwise runs it and streams
// stdout/stderr back as SSE (output / exit / error), persisting on completion.
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { sessionId } = await ctx.params;
    const { command } = await validateBody(req, runCommandSchema);

    const session = await prisma.terminalSession.findUnique({
      where: { id: sessionId },
      select: { id: true, projectId: true, userId: true, cwd: true, status: true },
    });
    if (!session) {
      throw new ApiError("Terminal session not found", 404, "NOT_FOUND");
    }
    if (session.status !== "ACTIVE") {
      throw new ApiError("Terminal session is closed", 409, "SESSION_CLOSED");
    }

    // Access control is derived from the session's project.
    const { user, project } = await requireProjectAccess(session.projectId);

    // Verify session ownership - only the session creator can execute commands
    if (!session.userId || session.userId !== user.id) {
      throw new ApiError("You do not own this terminal session", 403, "FORBIDDEN");
    }

    const storageKey = project!.storageKey;
    const workspaceId = project!.workspaceId;

    // Throttle command execution per user (30/min).
    await enforceRateLimit(`terminal:run:${user.id}`, 30, 60_000);

    // Quota check: enforce compute_minutes limit before running.
    await checkQuota(workspaceId, "compute_minutes");

    // Atomically acquire the single-command slot for this session. The
    // previous code used a separate `isRunning` check + later `running.set`
    // inside runCommand, leaving a TOCTOU window. `tryAcquire` is the
    // single point of truth now: it both checks and reserves. We also
    // `release` the slot on every error path below.
    if (!tryAcquire(sessionId)) {
      throw new ApiError(
        "A command is already running in this session",
        409,
        "SESSION_BUSY"
      );
    }

    // --- Safety policy ---
    const verdict = validateCommand(command);
    if (!verdict.ok) {
      // No real spawn happened; release the slot we acquired above.
      release(sessionId);
      const notice = `[blocked by safety policy] ${verdict.reason}`;
      await prisma.terminalCommand.create({
        data: { sessionId, command, output: notice, exitCode: 126 },
      });
      return apiError(notice, 400, "BLOCKED_COMMAND", { reason: verdict.reason });
    }

    // --- `cd` is handled specially: update session.cwd (validated) ---
    const cdTarget = parseCd(command);
    if (cdTarget !== null) {
      let newCwd: string;
      try {
        newCwd = changeDir(storageKey, session.cwd, cdTarget);
      } catch (err) {
        // Invalid cd target - no real spawn happened; release the slot.
        release(sessionId);
        const reason =
          err instanceof ApiError ? err.message : "Invalid directory";
        const notice = `[blocked] ${reason}`;
        await prisma.terminalCommand.create({
          data: { sessionId, command, output: notice, exitCode: 1 },
        });
        return apiError(notice, 400, "BLOCKED_COMMAND", { reason });
      }

      await prisma.terminalSession.update({
        where: { id: sessionId },
        data: { cwd: newCwd },
      });
      await prisma.terminalCommand.create({
        data: { sessionId, command, output: "", exitCode: 0 },
      });
      // cd completed - release the slot.
      release(sessionId);

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(sse("cwd", { cwd: newCwd })));
          controller.enqueue(encoder.encode(sse("exit", { code: 0 })));
          controller.close();
        },
      });
      return new Response(stream, { headers: sseHeaders() });
    }

    // --- Run a real command, streaming output ---
    const absCwd = resolveProjectCwd(storageKey, session.cwd);
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const safeEnqueue = (s: string) => {
          try {
            controller.enqueue(encoder.encode(s));
          } catch {
            /* controller already closed */
          }
        };

        if (verdict.warning) {
          safeEnqueue(sse("warning", { message: verdict.warning }));
        }

        try {
          const startTime = Date.now();
          const result = await runCommand({
            sessionId,
            command,
            cwd: absCwd,
            storageKey,
            relCwd: session.cwd,
            audit: { userId: user.id, projectId: session.projectId },
            onOutput: (chunk) => safeEnqueue(sse("output", { chunk })),
          });
          const elapsedMs = Date.now() - startTime;

          // Persist the captured command result (output already truncated).
          await prisma.terminalCommand.create({
            data: {
              sessionId,
              command,
              output: result.output,
              exitCode: result.exitCode ?? null,
            },
          });
          await prisma.terminalSession.update({
            where: { id: sessionId },
            data: { updatedAt: new Date() },
          });

          // Record compute minutes usage (rounded up, minimum 1 if non-zero).
          const minutes = Math.ceil(elapsedMs / 60_000);
          if (minutes > 0) {
            await recordUsage(workspaceId, "compute_minutes", minutes, {
              source: "terminal/run",
              sessionId,
            });
          }

          safeEnqueue(sse("exit", { code: result.exitCode }));
        } catch (err) {
          const message =
            err instanceof ApiError ? err.message : "Command execution failed";
          safeEnqueue(sse("error", { message }));
          try {
            await prisma.terminalCommand.create({
              data: { sessionId, command, output: message, exitCode: 1 },
            });
          } catch {
            /* best-effort */
          }
        } finally {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      },
    });

    return new Response(stream, { headers: sseHeaders() });
  } catch (err) {
    return handleApiError(err);
  }
}

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}