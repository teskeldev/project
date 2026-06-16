# Teskel — Deployment Package

Companion docs: [AGENT_QUEUE_ARCHITECTURE](./AGENT_QUEUE_ARCHITECTURE.md) ·
[TERMINAL_SANDBOX_SECURITY](./TERMINAL_SANDBOX_SECURITY.md) ·
[OBSERVABILITY](./OBSERVABILITY.md) · [OPERATIONS](./OPERATIONS.md)

Topology: reverse proxy / LB → N× **web** (Next.js) + M× **worker** (BullMQ),
backed by **Postgres** and **Redis**, with **object storage** for project files
and a **container runtime** for the terminal sandbox.

---

## 1. Production environment variable checklist

**Required (app will refuse to start / misbehave without these):**

| Var | Notes |
|-----|-------|
| `DATABASE_URL` | Postgres DSN; include `?connection_limit=...` or use PgBouncer |
| `AUTH_SECRET` | 32-byte random (`openssl rand -hex 32`); identical across all web instances |
| `CSRF_SECRET` | 32-byte random |
| `ENCRYPTION_KEY` | 32-byte random; **rotating it invalidates stored integration secrets** |
| `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` | canonical public URL |
| `AUTH_TRUST_HOST=true` | **required behind a proxy/LB** (also set in code via `trustHost`) |

**Required for production features:**

| Var | Enables |
|-----|---------|
| `REDIS_URL` | durable agent queue + cross-instance SSE (without it → in-process fallback, single instance only) |
| `TERMINAL_SANDBOX=docker` | containerized command execution (terminal is **disabled in prod** otherwise) |
| `AI_PROVIDER` / `OPENAI_API_KEY` (or per-workspace integration) | AI agents/chat |
| `PROJECT_STORAGE_BACKEND=s3` + `S3_*` | shared object storage (use this, not `local`, for multi-instance) |

**Recommended:**

`METRICS_TOKEN` (enables `/api/metrics`), `SENTRY_DSN`, `LOG_LEVEL=info`,
`AGENT_WORKER_CONCURRENCY`, `AGENT_JOB_ATTEMPTS`, `MAX_TERMINAL_TIMEOUT_SECONDS`,
Stripe keys (billing), `RESEND_API_KEY`/`EMAIL_FROM` (email).

Validate before deploy: every required var set, `AUTH_SECRET` matches across web
nodes, `ENCRYPTION_KEY` matches the value used to encrypt existing secrets.

---

## 2. Docker deployment guide

Two images from one Dockerfile:

```bash
# Web (Next.js standalone)
docker build -t teskel-web:<tag> .
# Worker (BullMQ)
docker build --target worker -t teskel-worker:<tag> .
```

Run (compose or orchestrator); web and worker share the same env:

```bash
docker run -d --env-file .env.prod -p 3000:3000 teskel-web:<tag>
docker run -d --env-file .env.prod teskel-worker:<tag>
```

Notes:
- The web image runs as non-root (`nextjs`), has a `HEALTHCHECK` on `/api/health`.
- Put it behind a proxy that terminates TLS and forwards `X-Forwarded-Host`/`-Proto`.
- The **sandbox** needs a container runtime reachable from the process that runs
  terminal commands (the web or worker host). Prefer **rootless Docker/Podman**
  or a scoped socket proxy; never expose the raw docker socket to untrusted
  containers. The project storage dir must be a path the runtime can bind-mount
  (shared volume), see TERMINAL_SANDBOX_SECURITY §5.

## 3. Worker deployment guide

```bash
docker run -d --env-file .env.prod teskel-worker:<tag>   # = npx tsx src/worker/index.ts
```

- Requires `REDIS_URL`. Exits non-zero immediately if unset (fail-fast).
- Scale by running more instances; tune `AGENT_WORKER_CONCURRENCY` (default 5).
- Graceful shutdown on SIGTERM/SIGINT: stops taking jobs, lets active ones settle,
  in-flight runs revert to `QUEUED` and resume on another worker. Safe for rolling deploys.
- Autoscale signal: `agent_queue_depth{state="waiting"}`.

## 4. Redis configuration guide

- **Persistence:** AOF on (`appendonly yes`) so queued jobs survive restart.
- **Eviction:** `maxmemory-policy noeviction` (NEVER `allkeys-lru` — it would drop
  queue keys). Size `maxmemory` with headroom over peak queue depth.
- **Connectivity:** BullMQ needs a TCP Redis (ioredis). Upstash works via its TCP
  endpoint. `maxRetriesPerRequest: null` is set in code (required by BullMQ).
- **HA:** managed Redis or Sentinel/cluster at scale; one logical DB is fine.
- Rate-limiter (separate) uses Upstash REST (`UPSTASH_REDIS_REST_*`) when set.

## 5. Postgres configuration guide

- Version: Postgres 16 with **pgvector** (semantic search uses vector columns).
- **Migrations:** `npx prisma migrate deploy` (idempotent, additive, verified
  zero-drift from both fresh and the previous prod schema). Run once per deploy
  before starting web/worker.
- **Connections:** put **PgBouncer** (transaction pooling) in front; size
  `connection_limit` in `DATABASE_URL` to fit `max_connections`.
- **Tuning (starting point):** `shared_buffers=256MB`, `work_mem=16MB`,
  `effective_cache_size`≈75% RAM. Add a read replica at the 10k-user tier.
- Indexes/constraints are all in migrations; no manual DDL needed.

## 6. Backup & recovery procedures

**Backup (daily + WAL):**
```bash
# logical daily dump to object storage
pg_dump "$DATABASE_URL" | gzip | aws s3 cp - s3://teskel-backups/daily/$(date +%F).sql.gz
# continuous WAL archiving for PITR (or use managed PITR: RDS/Neon/Supabase)
```
- Redis: AOF file is the queue backup; the **Postgres row is the source of truth**
  for agent runs, so a lost Redis only drops not-yet-processed jobs (re-enqueue
  any `QUEUED` runs).
- Object storage: enable bucket versioning.

**Recovery / DR:**
1. Provision Postgres, restore latest dump: `gunzip -c backup.sql.gz | psql "$DATABASE_URL"`
   (or PITR to a timestamp).
2. `prisma migrate deploy` (no-op if dump already current).
3. Point `DATABASE_URL` at the restored instance; restart web + worker.
4. Verify `/api/health` = `ok`, run the smoke checks (OPERATIONS §runbook).

**RPO/RTO targets:** daily dump + WAL → RPO ≤ 5 min (PITR) / ≤ 24 h (dump only);
RTO ≈ time to restore + migrate (minutes for managed PITR).
Test restore quarterly (procedure verified in the release validation).
