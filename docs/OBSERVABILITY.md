# Observability

Three pillars, all server-side and optional-by-config:

| Pillar | Tech | Entry point |
|--------|------|-------------|
| Logs | pino (JSON + redaction) | `src/lib/logger.ts` |
| Metrics | prom-client | `src/lib/observability/metrics.ts`, `GET /api/metrics` |
| Errors/Tracing | Sentry (`@sentry/node`) | `src/lib/observability/sentry.ts`, `src/instrumentation.ts` |

## Metrics catalogue

| Metric | Type | Labels | Meaning |
|--------|------|--------|---------|
| `http_requests_total` | counter | method, route, status | request volume + error rate |
| `http_request_duration_seconds` | histogram | method, route, status | per-route latency |
| `agent_jobs_total` | counter | outcome | completed/retried/dead_letter |
| `agent_run_duration_seconds` | histogram | — | end-to-end run time |
| `agent_queue_depth` | gauge | state | waiting/active/failed/delayed |
| `nodejs_*`, `process_*` | various | — | runtime (event-loop lag, heap, GC, RSS, CPU) |

### Per-route latency histograms

Routes opt in with a one-line wrapper (keeps the `route` label low-cardinality —
always the static pattern, never the concrete URL):

```ts
import { withRouteMetrics } from "@/lib/observability/metrics";
export const GET = withRouteMetrics("/api/health", async (req) => { /* ... */ });
```

Wired today: `/api/health`, `/api/dashboard/summary`. Error envelopes are also
counted centrally in `handleApiError`, so 4xx/5xx are captured for every route
even before it adopts the wrapper. Roll the wrapper out to remaining hot routes
incrementally.

## Scraping

`GET /api/metrics` requires `Authorization: Bearer $METRICS_TOKEN` (returns 404
if the token is unset — fails safe). Example Prometheus scrape:

```yaml
scrape_configs:
  - job_name: teskel-web
    authorization: { credentials: "${METRICS_TOKEN}" }
    static_configs: [{ targets: ["web:3000"] }]
    metrics_path: /api/metrics
```

Each web + worker instance exposes its own series; aggregate in Prometheus.

## Dashboards

`docs/observability/grafana-dashboard.json` — import into Grafana. Panels: API
rate by status, per-route latency percentiles, queue depth, worker job outcomes,
agent run duration, runtime (loop lag + RSS), AI streaming latency.

## Alert thresholds

`docs/observability/alerts.yml` (load as a Prometheus `rule_files` entry):

| Alert | Condition | Severity |
|-------|-----------|----------|
| HighApiErrorRate | 5xx rate > 2% for 5m | critical |
| ApiLatencyP95High | route p95 > 1s for 10m | warning |
| ApiDown | instance `up == 0` for 1m | critical |
| AgentQueueBacklog | waiting > 100 for 10m | warning |
| AgentDeadLetterGrowing | any dead-letter in 15m | critical |
| AgentRunDurationP95High | run p95 > 5m for 15m | warning |
| EventLoopLagHigh | loop lag > 200ms for 5m | warning |
| ProcessMemoryHigh | RSS > 1.5GB for 10m | warning |

## Sentry

Set `SENTRY_DSN` to enable. `logger.error(...)`, all 5xx/unknown errors in
`handleApiError`, and worker failures are forwarded automatically (headers
scrubbed in `beforeSend`). Tracing sample rate via `SENTRY_TRACES_SAMPLE_RATE`.
