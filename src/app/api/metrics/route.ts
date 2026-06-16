/**
 * GET /api/metrics — Prometheus scrape endpoint.
 *
 * Protected by a bearer token (METRICS_TOKEN) so internal series aren't public.
 * If METRICS_TOKEN is unset the endpoint is disabled (404) to fail safe rather
 * than leak metrics by default. Point Prometheus at this route with the token
 * in an Authorization header.
 */
import { timingSafeEqual } from "node:crypto";
import {
  metricsText,
  metricsContentType,
  agentQueueDepth,
} from "@/lib/observability/metrics";
import { getAgentQueue } from "@/lib/queue/agent-queue";

export const dynamic = "force-dynamic";

/** Constant-time string compare to avoid leaking the token via timing. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function GET(req: Request): Promise<Response> {
  const expected = process.env.METRICS_TOKEN;
  if (!expected) {
    return new Response("Not found", { status: 404 });
  }
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  if (!safeEqual(token, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Sample live queue depth at scrape time (best-effort; ignore if no queue).
  try {
    const queue = getAgentQueue();
    if (queue) {
      const counts = await queue.getJobCounts(
        "waiting",
        "active",
        "failed",
        "delayed"
      );
      agentQueueDepth.set({ state: "waiting" }, counts.waiting ?? 0);
      agentQueueDepth.set({ state: "active" }, counts.active ?? 0);
      agentQueueDepth.set({ state: "failed" }, counts.failed ?? 0);
      agentQueueDepth.set({ state: "delayed" }, counts.delayed ?? 0);
    }
  } catch {
    /* queue metrics are best-effort */
  }

  const body = await metricsText();
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": metricsContentType },
  });
}
