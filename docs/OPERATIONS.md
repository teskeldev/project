# Teskel — Operations Package

Companion: [DEPLOYMENT](./DEPLOYMENT.md) · [OBSERVABILITY](./OBSERVABILITY.md) ·
[AGENT_QUEUE_ARCHITECTURE](./AGENT_QUEUE_ARCHITECTURE.md) ·
[TERMINAL_SANDBOX_SECURITY](./TERMINAL_SANDBOX_SECURITY.md)

## 1. Production runbook

### Deploy
1. **Pre-flight:** env checklist (DEPLOYMENT §1) complete; `AUTH_SECRET`/`ENCRYPTION_KEY`
   consistent; `pg_dump` snapshot taken; new image tags built & scanned.
2. **Migrate:** `npx prisma migrate deploy` (additive, zero-drift — verified).
3. **Release:** roll web instances (behind LB), then worker instances. Both share env.
4. **Verify:** `/api/health` → `{status:ok, database:connected, redis:connected}`;
   run smoke (login → create project → 1 agent run → 1 terminal command in a container).
5. **Watch:** dashboards for 15 min — 5xx rate, p95, `agent_queue_depth`, loop lag.

### Scale
- Web: add instances on CPU>70% or p95 breach.
- Worker: add instances on `agent_queue_depth{state="waiting"}` sustained > 0.
- DB: PgBouncer first; read replica when CPU/conns saturate.

### Routine
- Confirm daily `pg_dump` succeeded; verify Redis AOF size sane.
- Review `agent_jobs_total{outcome="dead_letter"}` — investigate any growth.
- Rotate logs (stdout → aggregator); review Sentry triage weekly.

## 2. Incident response guide

| Symptom | First checks | Action |
|---|---|---|
| API 5xx spike (`HighApiErrorRate`) | Sentry, app logs, recent deploy | roll back image if release-correlated; check DB/Redis health |
| Login failing | proxy forwards `X-Forwarded-Host`?; `AUTH_TRUST_HOST`/`trustHost`; `AUTH_SECRET` parity | fix env; restart web |
| Agents stuck `QUEUED` | `agent_queue_depth{waiting}`; workers up?; Redis reachable? | scale/restart workers; check `REDIS_URL` |
| Agents failing | `agent_jobs_total{outcome=dead_letter}`; inspect `agent-runs-dlq`; AI key/quota | fix provider/quota; replay DLQ jobs |
| DB down | `/api/health` `database:error` | failover / PITR restore; app returns clean 503s |
| Redis down | health `redis:error` | API stays up; agents pause; restore Redis (AOF) then workers resume |
| Sandbox abuse / host load | container count; per-user limits/quotas | cap concurrency; rotate host; consider gVisor/Kata |
| Disk/storage full | object store / DB volume | extend volume; prune old artifacts |

Severity: **SEV1** = login down / API >25% errors / DB down. **SEV2** = agents
down, elevated errors. **SEV3** = degraded latency, single-feature issue.

## 3. Monitoring dashboard guide

Import `docs/observability/grafana-dashboard.json`. Panels & what "good" looks like:

| Panel | Healthy | Investigate |
|---|---|---|
| API request rate by status | 5xx ≈ 0 | any sustained 5xx |
| API latency p50/p95/p99 by route | p95 < ~300 ms | rising p95, one hot route |
| Queue depth by state | waiting ≈ 0, active ≤ workers×conc | waiting climbing |
| Worker job outcomes | mostly `completed` | any `dead_letter` |
| Agent run duration | stable | p95 climbing (AI latency / context size) |
| Runtime (loop lag, RSS) | lag < 50 ms, RSS flat | lag spikes, RSS growth (leak) |
| AI streaming latency | provider-bound | sustained increase → provider issue |

Scrape `/api/metrics` with `Authorization: Bearer $METRICS_TOKEN` (DEPLOYMENT/OBSERVABILITY).

## 4. Alert response procedures

Rules in `docs/observability/alerts.yml`. Response per alert:

- **HighApiErrorRate (crit):** open Sentry, correlate with deploy → roll back or hotfix.
- **ApiLatencyP95High (warn):** identify hot route; check DB slow queries / N+1; scale web.
- **ApiDown (crit):** page on-call; check instance/LB/health; restart/replace.
- **AgentQueueBacklog (warn):** scale workers; confirm Redis healthy; check for poison job.
- **AgentDeadLetterGrowing (crit):** inspect `agent-runs-dlq`; root-cause (AI key/quota/bug); replay after fix.
- **AgentRunDurationP95High (warn):** check provider latency, context size, model routing.
- **EventLoopLagHigh / ProcessMemoryHigh (warn):** profile; check for sync work / leak; restart if needed; scale.

## 5. On-call checklist

**Start of shift**
- [ ] Dashboards green (5xx, p95, queue depth, loop lag).
- [ ] No firing alerts; ack any open incidents.
- [ ] Last nightly `pg_dump` succeeded.
- [ ] DLQ empty/stable; workers healthy.
- [ ] Access to: cloud console, DB, Redis, Sentry, logs, runbook.

**On alert**
- [ ] Classify SEV; for SEV1 page secondary + start incident doc.
- [ ] Use the incident table (§2) for first checks.
- [ ] If release-correlated → roll back (stateless web/worker; migrations are additive).
- [ ] Communicate status; mitigate before root-cause.

**End of shift**
- [ ] Hand off open incidents; note anomalies.
- [ ] File follow-ups for any toil/false-positive alerts.
