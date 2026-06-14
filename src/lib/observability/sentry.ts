/**
 * Thin Sentry wrapper (SERVER-ONLY).
 *
 * Sentry is OPTIONAL: with no `SENTRY_DSN` every function here is a cheap no-op,
 * so dev/CI and self-hosted deploys that don't use Sentry pay nothing. When a
 * DSN is present we initialise `@sentry/node` once (lazily) with tracing enabled
 * and a `beforeSend` scrubber as a second line of defence against PII leaks.
 *
 * NOTE: this module must NOT import the logger (the logger imports it) — it logs
 * its own init failures via console to avoid an import cycle.
 */
import * as Sentry from "@sentry/node";

let initialised = false;
let enabled = false;

export function initSentry(): void {
  if (initialised) return;
  initialised = true;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? "development",
      release: process.env.APP_RELEASE,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
      // Drop common sensitive headers before anything leaves the process.
      beforeSend(event) {
        if (event.request?.headers) {
          for (const h of ["authorization", "cookie", "x-api-key"]) {
            delete event.request.headers[h];
          }
        }
        return event;
      },
    });
    enabled = true;
  } catch (err) {
    // Never let observability setup crash the app.
    console.error("[sentry] init failed", err);
  }
}

export function isSentryEnabled(): boolean {
  return enabled;
}

export function captureException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (!initialised) initSentry();
  if (!enabled) return;
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    /* swallow — telemetry must never throw into the caller */
  }
}

/** Flush buffered events on shutdown (worker SIGTERM, etc.). */
export async function flushSentry(timeoutMs = 2_000): Promise<void> {
  if (!enabled) return;
  try {
    await Sentry.flush(timeoutMs);
  } catch {
    /* ignore */
  }
}
