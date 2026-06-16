# Durable Agent Execution — BullMQ + Redis

## Why

Agent runs were driven **inside the SSE HTTP request** with an in-memory
registry and `AbortController`. That meant: work died on cold start / restart,
couldn't survive a dropped connection, couldn't scale past one process, and had
no retries or failure capture. This subsystem replaces that with a durable,
horizontally-scalable queue while keeping a **zero-dependency fallback** for dev
and CI (no Redis required).

## Components

| Module | Responsibility |
|--------|----------------|
| `src/lib/queue/connection.ts` | ioredis connection factory; `isQueueEnabled()` (true iff `REDIS_URL` set) |
| `src/lib/queue/agent-queue.ts` | BullMQ work queue + dead-letter queue; `enqueueAgentRun`, retry/backoff policy, `sendToDeadLetter` |
| `src/lib/queue/event-bus.ts` | Cross-instance pub/sub for run events + cancellation (Redis pattern-subscriber; in-memory fallback) |
| `src/lib/agents/runner.ts` | `driveAgentRun` (atomic claim + steps), `startAgentRun` (enqueue), `cancel` (over bus) |
| `src/worker/agent-worker.ts` | BullMQ `Worker`: concurrency, retries, DLQ on exhaustion, metrics |
| `src/worker/index.ts` | Worker process entrypoint: env load, graceful shutdown, Sentry flush |

## Topology (queue mode, `REDIS_URL` set)

```
            POST /api/projects/:id/agents
                       │  startAgentRun(): create QUEUED row + enqueueAgentRun()
                       ▼
   ┌─────────────┐  add job (jobId = runId)   ┌───────────────┐
   │  Web (Next) │ ─────────────────────────▶ │     Redis     │
   │  N replicas │                            │  BullMQ + P/S │
   └─────────────┘                            └───────────────┘
        ▲   │ GET /api/agents/:id/events (SSE)      ▲   │ BRPOPLPUSH
        │   │ subscribeEvents()  ◀───── publish ────┘   ▼
        │   │ agent:events:<id>                    ┌───────────────┐
        │   └──────────────────────────────────── │  Worker(s)    │
        │     publishCancel() ──── agent:cancel ──▶│  M replicas   │
        │                                          │ driveAgentRun │
        └────────── events streamed to browser ────└───────────────┘
                                                        │ reads/writes
                                                        ▼  Postgres (AgentRun/Step/ChangeSet)
```

- **Web replicas** never execute runs; they only enqueue and stream events.
- **Worker replicas** claim and drive runs; events/cancel flow over Redis pub/sub
  so any web replica can stream a run executing on any worker.

## Execution lifecycle

```
QUEUED ──(worker claim: updateMany QUEUED→RUNNING, count==1)──▶ RUNNING
RUNNING ──steps: THINK→SEARCH→READ_FILE→GIT→DIFF→REVIEW──▶ WAITING_APPROVAL
RUNNING ──error, attempts remain──▶ QUEUED (revert claim, BullMQ backoff retry)
RUNNING ──error, attempts exhausted──▶ FAILED  (+ copied to agent-runs-dlq)
RUNNING ──cancel published──▶ CANCELLED (abort in-flight AI calls)
```

The **atomic `QUEUED→RUNNING` claim** (`prisma.agentRun.updateMany` filtered on
`status: "QUEUED"`) is the cross-instance guard: exactly one process drives a
run even if a worker and an SSE fallback race, or two workers pick it up.

## Reliability properties

- **Retries / backoff**: `attempts` (default 3, env `AGENT_JOB_ATTEMPTS`),
  exponential backoff (2 s base). A retryable failure reverts the run to
  `QUEUED` so the next attempt re-claims it.
- **Dead-letter**: on the final failed attempt the worker copies the payload to
  `agent-runs-dlq` (never auto-processed) and the run is marked `FAILED`.
- **Idempotency**: `jobId = agentRunId`, so a duplicate enqueue is a no-op.
- **Job persistence**: jobs live in Redis (use AOF/RDB persistence — see
  docker-compose `--appendonly yes`); the Postgres row is the source of truth.
- **Graceful shutdown**: `worker.close()` stops new jobs and lets active ones
  settle before exit — safe for rolling deploys.
- **Backpressure**: per-worker `concurrency` (env `AGENT_WORKER_CONCURRENCY`,
  default 5); scale throughput by adding worker replicas.

## Configuration

| Env | Default | Meaning |
|-----|---------|---------|
| `REDIS_URL` | _(unset)_ | Enables the queue. Unset → in-process fallback. |
| `AGENT_JOB_ATTEMPTS` | `3` | Max attempts per run before dead-letter. |
| `AGENT_WORKER_CONCURRENCY` | `5` | Concurrent runs per worker process. |

## Running

```bash
# infra
docker compose up -d            # postgres + redis
export REDIS_URL=redis://localhost:6379

# processes (scale each independently)
npm run start                   # web (Next.js)
npm run worker                  # agent worker(s) — run 1..N
```

## Migration notes

1. **No schema change.** Reuses the existing `AgentRun`/`AgentStep` tables and
   their status enum. The new `QUEUED→RUNNING` claim relies on the existing
   `status` column only.
2. **Backwards compatible.** With `REDIS_URL` unset the app behaves exactly as
   before (SSE drives the run in-process); the 195-test suite runs with no Redis.
3. **Deploy order.** Roll out web + worker together. If web is enqueuing before
   any worker is up, runs simply sit `QUEUED` until a worker starts — no loss.
4. **Draining old behaviour.** Any run created before the worker exists can still
   be driven by opening its SSE stream (fallback path), so there's no stuck-run
   window during the cutover.
5. **Observability.** `agent_queue_depth`, `agent_run_duration_seconds`, and
   `agent_jobs_total{outcome}` are exported at `/api/metrics`; alert on rising
   `agent_queue_depth{state="waiting"}` (workers under-provisioned) and on
   `agent_jobs_total{outcome="dead_letter"}` (persistent failures).
