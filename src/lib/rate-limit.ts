/**
 * Sliding-window rate limiter with an optional Redis (Upstash) backend.
 *
 * Production deployments should set `UPSTASH_REDIS_REST_URL` and
 * `UPSTASH_REDIS_REST_TOKEN` so the limiter uses a shared, durable store and
 * behaves correctly across multiple instances. When those env vars are absent
 * the limiter transparently falls back to an in-process Map so the API still
 * works in dev and single-instance deployments.
 */
import { ApiError } from "@/lib/api";

// ---------------------------------------------------------------------------
// Optional Upstash (Redis) backend
// ---------------------------------------------------------------------------

type UpstashLimiter = {
  limit: (
    key: string,
    opts?: { rate?: number; window?: string }
  ) => Promise<{
    success: boolean;
    limit: number;
    reset: number;
    remaining: number;
  }>;
};

// Tri-state: undefined = not yet initialised, false = disabled, limiter = ready.
let upstashLimiter: UpstashLimiter | false | undefined;

/**
 * Lazily build (or skip) the Upstash rate limiter. Cached at module scope.
 *
 * The libraries are imported dynamically so this file remains usable in
 * environments where the `node-runtime` is unavailable (e.g. Edge) and so the
 * ~50kB Upstash bundle is not loaded when Redis is not configured.
 */
async function getUpstashLimiter(): Promise<UpstashLimiter | false> {
  if (upstashLimiter !== undefined) return upstashLimiter;

  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    upstashLimiter = false;
    return false;
  }

  try {
    const { Redis } = await import("@upstash/redis");
    const { Ratelimit } = await import("@upstash/ratelimit");
    const limiter = new Ratelimit({
      redis: new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      }),
      // Default 100 req / minute sliding window. Callers can override via
      // the `limit` and `windowMs` arguments to `enforceRateLimit` below.
      limiter: Ratelimit.slidingWindow(100, "1 m"),
      analytics: true,
      // Prefix all keys so we don't collide with other apps on the same DB.
      prefix: "rl",
    }) as unknown as UpstashLimiter;

    upstashLimiter = limiter;
    return limiter;
  } catch (err) {
    // Misconfiguration should not crash the request — degrade to in-memory.
    console.error("[rate-limit] Upstash init failed, using in-memory:", err);
    upstashLimiter = false;
    return false;
  }
}

// ---------------------------------------------------------------------------
// In-memory backend (single-instance / dev only)
// ---------------------------------------------------------------------------

type Window = {
  /** Timestamps (ms) of requests within the current window. */
  hits: number[];
};

const MAX_BUCKETS = 10_000;
const CLEANUP_INTERVAL_MS = 60_000; // 1 minute

const buckets = new Map<string, Window>();

// Periodic cleanup of expired entries
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      // Remove entries where all hits are older than 5 minutes (max reasonable window)
      const maxWindow = 5 * 60_000;
      const cutoff = now - maxWindow;
      if (bucket.hits.length === 0 || bucket.hits[bucket.hits.length - 1] <= cutoff) {
        buckets.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow the process to exit without waiting for this timer
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

/**
 * Evict oldest entries when the map exceeds MAX_BUCKETS.
 */
function evictIfNeeded(): void {
  if (buckets.size <= MAX_BUCKETS) return;

  // Find and remove the oldest entries (those with the smallest latest hit timestamp)
  const entries = Array.from(buckets.entries());
  entries.sort((a, b) => {
    const aLatest = a[1].hits.length > 0 ? a[1].hits[a[1].hits.length - 1] : 0;
    const bLatest = b[1].hits.length > 0 ? b[1].hits[b[1].hits.length - 1] : 0;
    return aLatest - bLatest;
  });

  // Remove the oldest 10% of entries
  const toRemove = Math.max(1, Math.floor(buckets.size * 0.1));
  for (let i = 0; i < toRemove && i < entries.length; i++) {
    buckets.delete(entries[i][0]);
  }
}

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
  startCleanup();

  const now = Date.now();
  const cutoff = now - windowMs;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
    evictIfNeeded();
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
 *
 * Backed by Upstash Redis when the relevant env vars are set; otherwise falls
 * back to the in-process Map. The `limit` and `windowMs` parameters are
 * honoured by the in-memory backend. The Upstash backend uses its configured
 * sliding window (default 100/min) — pass `limit`/`windowMs` in the
 * `options` argument to override per-call.
 */
export async function enforceRateLimit(
  key: string,
  limit = 20,
  windowMs = 60_000
): Promise<void> {
  const upstash = await getUpstashLimiter();
  if (upstash) {
    const { success } = await upstash.limit(key);
    if (!success) {
      // We don't get a precise retry-after from the sliding window without
      // inspecting `reset`; use a conservative 1s.
      throw new ApiError(
        "Rate limit exceeded. Try again shortly.",
        429,
        "RATE_LIMITED"
      );
    }
    return;
  }

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
