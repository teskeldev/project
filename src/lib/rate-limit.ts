/**
 * Tiny in-memory sliding-window rate limiter keyed by an arbitrary id
 * (typically a userId). Suitable for single-instance dev/local use only.
 *
 * PRODUCTION NOTE: this state lives in process memory and is NOT shared across
 * instances or persisted across restarts. For real deployments back this with
 * Redis (e.g. a sorted-set sliding window or token bucket).
 */
import { ApiError } from "@/lib/api";

type Window = {
  /** Timestamps (ms) of requests within the current window. */
  hits: number[];
};

const buckets = new Map<string, Window>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** ms until the window frees up at least one slot (0 when allowed). */
  retryAfterMs: number;
};

/**
 * Records a hit for `key` and reports whether it is within the limit.
 *
 * @param key       identity to throttle (e.g. userId or `userId:endpoint`)
 * @param limit     max requests allowed per window (default 20)
 * @param windowMs  window length in ms (default 60_000 = 1 minute)
 */
export function rateLimit(
  key: string,
  limit = 20,
  windowMs = 60_000
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }

  // Drop timestamps that fell out of the window.
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  bucket.hits.push(now);
  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.hits.length),
    retryAfterMs: 0,
  };
}

/**
 * Convenience wrapper that throws ApiError(429) when the limit is exceeded.
 */
export function enforceRateLimit(
  key: string,
  limit = 20,
  windowMs = 60_000
): void {
  const result = rateLimit(key, limit, windowMs);
  if (!result.allowed) {
    const seconds = Math.ceil(result.retryAfterMs / 1000);
    throw new ApiError(
      `Rate limit exceeded. Try again in ${seconds}s.`,
      429,
      "RATE_LIMITED"
    );
  }
}
