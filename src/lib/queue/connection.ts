/**
 * Redis connection management for the BullMQ-backed job system.
 *
 * SERVER-ONLY. A single shared `ioredis` connection is reused for the queue
 * producer and the pub/sub publisher; BullMQ workers and the pub/sub subscriber
 * each require their own dedicated connection (a connection in "subscriber
 * mode" cannot issue normal commands), so those are created separately.
 *
 * The whole queue subsystem is OPTIONAL: when `REDIS_URL` is not set the app
 * falls back to in-process execution (see agent-queue.ts / event-bus.ts). This
 * keeps local dev and the test suite working with zero external dependencies
 * while enabling durable, horizontally-scalable execution in production.
 */
import Redis, { type RedisOptions } from "ioredis";
import { logger } from "@/lib/logger";

let producer: Redis | null = null;

/** Whether a Redis-backed queue is configured. */
export function isQueueEnabled(): boolean {
  return Boolean(process.env.REDIS_URL && process.env.REDIS_URL.trim());
}

function baseOptions(): RedisOptions {
  return {
    // BullMQ requires this to be null so blocking commands (BRPOPLPUSH) work.
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    // Exponential reconnect with a cap so a Redis blip doesn't hot-loop.
    retryStrategy: (times: number) => Math.min(times * 200, 5_000),
  };
}

/** Create a brand-new connection (used by workers and subscribers). */
export function createRedisConnection(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not configured; queue is disabled");
  }
  const conn = new Redis(url, baseOptions());
  conn.on("error", (err) => {
    logger.error("redis connection error", { error: err.message });
  });
  return conn;
}

/** Shared connection for the queue producer and the pub/sub publisher. */
export function getRedis(): Redis {
  if (!producer) producer = createRedisConnection();
  return producer;
}

/** Close all shared connections (graceful shutdown / test teardown). */
export async function closeRedis(): Promise<void> {
  if (producer) {
    await producer.quit().catch(() => undefined);
    producer = null;
  }
}
