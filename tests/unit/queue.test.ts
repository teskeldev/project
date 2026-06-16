import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  publishEvent,
  subscribeEvents,
  publishCancel,
  subscribeCancel,
} from "@/lib/queue/event-bus";
import { isQueueEnabled } from "@/lib/queue/connection";
import { enqueueAgentRun, defaultJobOptions } from "@/lib/queue/agent-queue";

/**
 * These tests cover the no-Redis FALLBACK path that local dev and CI use. The
 * Redis-backed path (real BullMQ retries / dead-letter / pub/sub) is verified
 * by the end-to-end harness in the queue refactor; here we lock in the
 * graceful-degradation contract so the app never hard-requires Redis.
 */
describe("queue (fallback / no Redis)", () => {
  const prev = process.env.REDIS_URL;
  beforeEach(() => {
    delete process.env.REDIS_URL;
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = prev;
  });

  it("reports the queue as disabled when REDIS_URL is unset", () => {
    expect(isQueueEnabled()).toBe(false);
  });

  it("enqueueAgentRun returns false (caller drives in-process)", async () => {
    const enqueued = await enqueueAgentRun({
      agentRunId: "r1",
      projectId: "p",
      userId: "u",
    });
    expect(enqueued).toBe(false);
  });

  it("event bus delivers events to local subscribers in-process", () => {
    const events: string[] = [];
    const unsub = subscribeEvents("run-x", (e) => events.push(e.type));
    publishEvent("run-x", { type: "planning" });
    publishEvent("run-x", { type: "completed" });
    unsub();
    publishEvent("run-x", { type: "failed", error: "after-unsub" });
    expect(events).toEqual(["planning", "completed"]);
  });

  it("does not cross-deliver events between different runs", () => {
    const a: string[] = [];
    const b: string[] = [];
    const ua = subscribeEvents("A", (e) => a.push(e.type));
    const ub = subscribeEvents("B", (e) => b.push(e.type));
    publishEvent("A", { type: "queued" });
    ua();
    ub();
    expect(a).toEqual(["queued"]);
    expect(b).toEqual([]);
  });

  it("delivers cancellation to a local cancel subscriber", () => {
    let cancelled = false;
    const unsub = subscribeCancel("run-c", () => {
      cancelled = true;
    });
    publishCancel("run-c");
    unsub();
    expect(cancelled).toBe(true);
  });

  it("exposes a sane default retry/backoff policy", () => {
    const opts = defaultJobOptions();
    expect(opts.attempts).toBeGreaterThanOrEqual(1);
    expect(opts.backoff).toMatchObject({ type: "exponential" });
  });
});
