/**
 * BullMQ queue definitions for durable agent execution.
 *
 * Two queues:
 *   - AGENT_QUEUE: the work queue. Each job drives one AgentRun to a terminal
 *     state. Jobs are retried with exponential backoff; after the final attempt
 *     the worker copies the payload into the dead-letter queue.
 *   - AGENT_DLQ: the dead-letter queue. Holds permanently-failed jobs for
 *     inspection / manual replay. Jobs here are never auto-processed.
 *
 * When REDIS_URL is absent these helpers no-op / return null and callers fall
 * back to in-process execution.
 */
import { Queue, type JobsOptions } from "bullmq";
import { logger } from "@/lib/logger";
import { getRedis, isQueueEnabled } from "./connection";

export const AGENT_QUEUE = "agent-runs";
export const AGENT_DLQ = "agent-runs-dlq";

/** Payload carried by every agent job. The DB row is the source of truth; the
 * job only needs the id to (re)drive it. */
export type AgentJobData = {
  agentRunId: string;
  projectId: string;
  userId: string;
};

/** Default retry/backoff policy. Tunable via env without code changes. */
export function defaultJobOptions(): JobsOptions {
  const attempts = Number(process.env.AGENT_JOB_ATTEMPTS ?? "3");
  return {
    attempts: Number.isFinite(attempts) && attempts > 0 ? attempts : 3,
    backoff: { type: "exponential", delay: 2_000 },
    // Keep a bounded history so the queue store doesn't grow unbounded.
    removeOnComplete: { count: 1_000, age: 24 * 3_600 },
    removeOnFail: { count: 5_000, age: 7 * 24 * 3_600 },
  };
}

let agentQueue: Queue<AgentJobData> | null = null;
let dlq: Queue<AgentJobData & { failedReason?: string }> | null = null;

export function getAgentQueue(): Queue<AgentJobData> | null {
  if (!isQueueEnabled()) return null;
  if (!agentQueue) {
    agentQueue = new Queue<AgentJobData>(AGENT_QUEUE, {
      connection: getRedis(),
      defaultJobOptions: defaultJobOptions(),
    });
  }
  return agentQueue;
}

export function getDeadLetterQueue(): Queue<
  AgentJobData & { failedReason?: string }
> | null {
  if (!isQueueEnabled()) return null;
  if (!dlq) {
    dlq = new Queue<AgentJobData & { failedReason?: string }>(AGENT_DLQ, {
      connection: getRedis(),
    });
  }
  return dlq;
}

/**
 * Enqueue an agent run. Returns true if a durable job was created, false when
 * the queue is disabled (caller should drive the run in-process instead).
 *
 * Uses the run id as the BullMQ jobId so a duplicate enqueue is idempotent.
 */
export async function enqueueAgentRun(data: AgentJobData): Promise<boolean> {
  const queue = getAgentQueue();
  if (!queue) return false;
  try {
    await queue.add("drive", data, { jobId: data.agentRunId });
    logger.info("agent run enqueued", { agentRunId: data.agentRunId });
    return true;
  } catch (err) {
    logger.error("failed to enqueue agent run", {
      agentRunId: data.agentRunId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/** Push a permanently-failed job into the dead-letter queue for inspection. */
export async function sendToDeadLetter(
  data: AgentJobData,
  failedReason: string
): Promise<void> {
  const q = getDeadLetterQueue();
  if (!q) return;
  await q
    .add("dead", { ...data, failedReason }, { removeOnComplete: false })
    .catch((err) =>
      logger.error("failed to write dead-letter job", {
        agentRunId: data.agentRunId,
        error: err instanceof Error ? err.message : String(err),
      })
    );
}

export async function closeQueues(): Promise<void> {
  await agentQueue?.close().catch(() => undefined);
  await dlq?.close().catch(() => undefined);
  agentQueue = null;
  dlq = null;
}
