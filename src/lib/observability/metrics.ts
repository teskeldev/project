/**
 * Prometheus metrics (SERVER-ONLY) via prom-client.
 *
 * A single shared registry collects:
 *   - Node/process default metrics (event-loop lag, heap, GC, ...).
 *   - HTTP request count + latency histogram (route + method + status).
 *   - Agent job lifecycle counters and a run-duration histogram.
 *   - Live agent queue depth (waiting/active) sampled on scrape.
 *
 * Scrape via GET /api/metrics (token-protected). Safe to import anywhere on the
 * server; collection is process-local (each web/worker instance exposes its own
 * series — aggregate in Prometheus/Grafana).
 */
import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Histogram,
  Gauge,
} from "prom-client";

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total HTTP requests handled by API routes",
  labelNames: ["method", "route", "status"] as const,
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "API route latency in seconds",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const agentJobsTotal = new Counter({
  name: "agent_jobs_total",
  help: "Agent jobs by terminal outcome",
  labelNames: ["outcome"] as const, // completed | failed | retried | dead_letter
  registers: [registry],
});

export const agentRunDuration = new Histogram({
  name: "agent_run_duration_seconds",
  help: "End-to-end agent run duration in seconds",
  buckets: [1, 5, 15, 30, 60, 120, 300, 600],
  registers: [registry],
});

export const agentQueueDepth = new Gauge({
  name: "agent_queue_depth",
  help: "Agent queue depth by state",
  labelNames: ["state"] as const, // waiting | active | failed | delayed
  registers: [registry],
});

/** Record a single HTTP request's outcome + latency. */
export function recordHttp(
  method: string,
  route: string,
  status: number,
  startNs: bigint
): void {
  const seconds = Number(process.hrtime.bigint() - startNs) / 1e9;
  const labels = { method, route, status: String(status) };
  httpRequestsTotal.inc(labels);
  httpRequestDuration.observe(labels, seconds);
}

/**
 * Wrap a Next.js route handler so every invocation records a per-route latency
 * histogram + request counter labelled by method/route/status. One-line opt-in:
 *
 *   export const GET = withRouteMetrics("/api/health", async (req) => { ... });
 *
 * The `route` label is the STATIC pattern (not the concrete URL) so cardinality
 * stays bounded — never interpolate ids into it.
 */
export function withRouteMetrics<
  H extends (...args: never[]) => Promise<Response>,
>(route: string, handler: H): H {
  const wrapped = async (...args: Parameters<H>): Promise<Response> => {
    const start = process.hrtime.bigint();
    const method =
      (args[0] as { method?: string } | undefined)?.method ?? "-";
    try {
      const res = await handler(...args);
      recordHttp(method, route, res.status, start);
      return res;
    } catch (err) {
      // handleApiError already counts the error envelope; still record latency.
      recordHttp(method, route, 500, start);
      throw err;
    }
  };
  return wrapped as H;
}

/** Render the metrics exposition text for the scrape endpoint. */
export async function metricsText(): Promise<string> {
  return registry.metrics();
}

export const metricsContentType = registry.contentType;
