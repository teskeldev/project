/**
 * BullMQ worker that durably executes agent runs.
 *
 * Runs as a SEPARATE process from the Next.js web server (see worker/index.ts),
 * so agent execution survives web cold starts / restarts and scales by running
 * more worker instances. Concurrency, retries and backoff are configured via
 * env. Jobs that exhaust their retries are copied to the dead-letter queue.
 */
import { Worker, type Job } from "bullmq";
import { createRedisConnection } from "@/lib/queue/connection";
import {
  AGENT_QUEUE,
  type AgentJobData,
  sendToDeadLetter,
} from "@/lib/queue/agent-queue";
import { driveAgentRun } from "@/lib/agents/runner";
import { logger } from "@/lib/logger";
import { agentJobsTotal, agentRunDuration } from "@/lib/observability/metrics";

export function createAgentWorker(): Worker<AgentJobData> {
  const concurrency = Number(process.env.AGENT_WORKER_CONCURRENCY ?? "5") || 5;

  const worker = new Worker<AgentJobData>(
    AGENT_QUEUE,
    async (job: Job<AgentJobData>) => {
      const attempts = job.opts.attempts ?? 1;
      // attemptsMade is 0 on the first run; willRetry is true while a further
      // attempt remains, so the run reverts to QUEUED instead of FAILED.
      const willRetry = job.attemptsMade + 1 < attempts;
      logger.info("agent job started", {
        jobId: job.id,
        agentRunId: job.data.agentRunId,
        attempt: job.attemptsMade + 1,
        attempts,
      });
      const endTimer = agentRunDuration.startTimer();
      try {
        await driveAgentRun(job.data.agentRunId, { willRetry });
      } finally {
        endTimer();
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: concurrency > 0 ? concurrency : 5,
    }
  );

  worker.on("completed", (job) => {
    agentJobsTotal.inc({ outcome: "completed" });
    logger.info("agent job completed", {
      jobId: job.id,
      agentRunId: job.data.agentRunId,
    });
  });

  worker.on("failed", (job, err) => {
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    const exhausted = job.attemptsMade >= attempts;
    agentJobsTotal.inc({ outcome: exhausted ? "dead_letter" : "retried" });
    logger.error("agent job failed", {
      jobId: job.id,
      agentRunId: job.data.agentRunId,
      attempt: job.attemptsMade,
      exhausted,
      error: err.message,
    });
    if (exhausted) {
      void sendToDeadLetter(job.data, err.message);
    }
  });

  worker.on("error", (err) => {
    logger.error("agent worker error", { error: err.message });
  });

  return worker;
}
