/**
 * Next.js instrumentation hook — runs once when the server process boots.
 * Used to initialise observability (Sentry) for the web server. Guarded to the
 * Node.js runtime because @sentry/node and prom-client are not edge-compatible.
 *
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initSentry } = await import("@/lib/observability/sentry");
    initSentry();
    // Importing the metrics module starts default (process) metric collection.
    await import("@/lib/observability/metrics");
  }
}
