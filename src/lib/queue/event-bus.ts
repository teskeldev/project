/**
 * Cross-instance event bus for agent runs.
 *
 * The SSE endpoint and the worker that executes a run may live in DIFFERENT
 * processes/instances. This bus decouples them:
 *
 *   - In QUEUE MODE (REDIS_URL set) events are published to Redis channels
 *     (`agent:events:<runId>`) and a single shared pattern-subscriber fans them
 *     out to local listeners. Cancellation flows the same way over
 *     `agent:cancel:<runId>`.
 *   - In FALLBACK MODE (no Redis) publish dispatches directly to local
 *     listeners in the same process — identical behaviour to the original
 *     in-memory registry, so dev and tests need no Redis.
 *
 * Either way callers use the same publish/subscribe API.
 */
import type Redis from "ioredis";
import type { AgentEvent } from "@/lib/agents/events";
import { logger } from "@/lib/logger";
import { createRedisConnection, getRedis, isQueueEnabled } from "./connection";

type EventListener = (event: AgentEvent) => void;
type CancelListener = () => void;

const EVENT_PREFIX = "agent:events:";
const CANCEL_PREFIX = "agent:cancel:";

/** runId -> local listeners (SSE handlers / the executing run's abort hook). */
const eventListeners = new Map<string, Set<EventListener>>();
const cancelListeners = new Map<string, Set<CancelListener>>();

let subscriber: Redis | null = null;
let subscriberReady = false;

/** Lazily create the shared pattern-subscriber connection (queue mode only). */
function ensureSubscriber(): void {
  if (!isQueueEnabled() || subscriber) return;
  subscriber = createRedisConnection();
  subscriber.on("pmessage", (_pattern, channel: string, payload: string) => {
    try {
      if (channel.startsWith(EVENT_PREFIX)) {
        const runId = channel.slice(EVENT_PREFIX.length);
        const event = JSON.parse(payload) as AgentEvent;
        dispatchEvent(runId, event);
      } else if (channel.startsWith(CANCEL_PREFIX)) {
        const runId = channel.slice(CANCEL_PREFIX.length);
        dispatchCancel(runId);
      }
    } catch (err) {
      logger.error("event-bus message parse failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
  subscriber
    .psubscribe(`${EVENT_PREFIX}*`, `${CANCEL_PREFIX}*`)
    .then(() => {
      subscriberReady = true;
    })
    .catch((err) =>
      logger.error("event-bus psubscribe failed", { error: err.message })
    );
}

function dispatchEvent(runId: string, event: AgentEvent): void {
  const set = eventListeners.get(runId);
  if (!set) return;
  for (const fn of set) {
    try {
      fn(event);
    } catch {
      /* a misbehaving listener must not break fan-out */
    }
  }
}

function dispatchCancel(runId: string): void {
  const set = cancelListeners.get(runId);
  if (!set) return;
  for (const fn of set) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

/** Publish an event for a run (to Redis in queue mode, else local fan-out). */
export function publishEvent(runId: string, event: AgentEvent): void {
  if (isQueueEnabled()) {
    getRedis()
      .publish(`${EVENT_PREFIX}${runId}`, JSON.stringify(event))
      .catch((err) =>
        logger.error("event-bus publish failed", { runId, error: err.message })
      );
    return;
  }
  dispatchEvent(runId, event);
}

/** Subscribe to a run's events. Returns an unsubscribe function. */
export function subscribeEvents(
  runId: string,
  listener: EventListener
): () => void {
  ensureSubscriber();
  let set = eventListeners.get(runId);
  if (!set) {
    set = new Set();
    eventListeners.set(runId, set);
  }
  set.add(listener);
  return () => {
    const s = eventListeners.get(runId);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) eventListeners.delete(runId);
  };
}

/** Request cancellation of a run (delivered to whichever process runs it). */
export function publishCancel(runId: string): void {
  if (isQueueEnabled()) {
    getRedis()
      .publish(`${CANCEL_PREFIX}${runId}`, "1")
      .catch((err) =>
        logger.error("event-bus cancel publish failed", {
          runId,
          error: err.message,
        })
      );
  }
  // Always dispatch locally too: covers in-process execution and the case
  // where the executing worker is this very process.
  dispatchCancel(runId);
}

/** Register a cancel handler for a run being executed in THIS process. */
export function subscribeCancel(
  runId: string,
  listener: CancelListener
): () => void {
  ensureSubscriber();
  let set = cancelListeners.get(runId);
  if (!set) {
    set = new Set();
    cancelListeners.set(runId, set);
  }
  set.add(listener);
  return () => {
    const s = cancelListeners.get(runId);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) cancelListeners.delete(runId);
  };
}

/** Test/diagnostic helper. */
export function _busState() {
  return { subscriberReady, runs: eventListeners.size };
}
