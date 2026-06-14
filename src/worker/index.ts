/**
 * Worker process entrypoint.
 *
 *   npm run worker          # production (compiled or via tsx)
 *
 * Loads the Next.js env, starts the agent worker, and wires graceful shutdown
 * so in-flight jobs finish (or are returned to the queue) on SIGTERM/SIGINT —
 * important for zero-drop rolling deploys.
 */
import { loadEnvConfig } from "@next/env";

// Load .env / .env.local exactly like the Next.js server does.
loadEnvConfig(process.cwd());

import { isQueueEnabled, closeRedis } from "@/lib/queue/connection";
import { closeQueues } from "@/lib/queue/agent-queue";
import { createAgentWorker } from "@/worker/agent-worker";
import { logger } from "@/lib/logger";
import { initSentry, flushSentry } from "@/lib/observability/sentry";

initSentry();

if (!isQueueEnabled()) {
  logger.error(
    "Worker requires REDIS_URL to be set (the queue is disabled without it). Exiting."
  );
  process.exit(1);
}

const worker = createAgentWorker();
logger.info("agent worker online", {
  concurrency: process.env.AGENT_WORKER_CONCURRENCY ?? "5",
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("worker shutting down", { signal });
  try {
    // Stop accepting new jobs and wait for active ones to settle.
    await worker.close();
    await closeQueues();
    await closeRedis();
    await flushSentry();
  } catch (err) {
    logger.error("error during worker shutdown", {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    process.exit(0);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  logger.error("uncaught exception in worker", { error: err.message });
});
process.on("unhandledRejection", (reason) => {
  logger.error("unhandled rejection in worker", { reason: String(reason) });
});
