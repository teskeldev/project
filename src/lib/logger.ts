/**
 * Structured logging built on pino (SERVER-ONLY).
 *
 * - JSON to stdout in production (one line per event) for log aggregators.
 * - Pretty-printed in development via pino-pretty when available.
 * - Secrets are REDACTED at the serializer level so an accidental
 *   `logger.info("x", { apiKey })` can never leak credentials to the logs.
 * - `error()` additionally forwards Error objects to Sentry (no-op without a
 *   DSN) so exceptions are tracked without sprinkling capture calls everywhere.
 *
 * The public API (info/warn/error/debug/child) is unchanged from the previous
 * console shim, so existing call sites keep working.
 */
import pino, { type Logger as PinoLogger } from "pino";
import { captureException } from "@/lib/observability/sentry";

const isProd = process.env.NODE_ENV === "production";
const level = process.env.LOG_LEVEL ?? (isProd ? "info" : "debug");

/** Keys whose values must never appear in logs. */
const REDACT_PATHS = [
  "password",
  "token",
  "apiKey",
  "api_key",
  "secret",
  "authorization",
  "cookie",
  "encryptionKey",
  "*.password",
  "*.token",
  "*.apiKey",
  "*.secret",
  "*.authorization",
];

function createBaseLogger(): PinoLogger {
  const options: pino.LoggerOptions = {
    level,
    redact: { paths: REDACT_PATHS, censor: "[redacted]" },
    base: { service: process.env.SERVICE_NAME ?? "teskel" },
    formatters: { level: (label) => ({ level: label }) },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  // Pretty output in dev when pino-pretty is installed; never in prod.
  if (!isProd) {
    try {
      return pino({
        ...options,
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss",
            ignore: "pid,hostname,service",
          },
        },
      });
    } catch {
      /* pino-pretty unavailable — fall through to JSON */
    }
  }
  return pino(options);
}

const base = createBaseLogger();

type Meta = Record<string, unknown>;

function wrap(l: PinoLogger) {
  return {
    info: (msg: string, meta?: Meta) => l.info(meta ?? {}, msg),
    warn: (msg: string, meta?: Meta) => l.warn(meta ?? {}, msg),
    debug: (msg: string, meta?: Meta) => l.debug(meta ?? {}, msg),
    error: (msg: string, meta?: Meta) => {
      l.error(meta ?? {}, msg);
      // Forward to Sentry. Prefer a real Error instance if one was passed.
      const err = meta?.error;
      captureException(err instanceof Error ? err : new Error(msg), meta);
    },
    child: (bindings: Meta) => wrap(l.child(bindings)),
  };
}

export const logger = wrap(base);
