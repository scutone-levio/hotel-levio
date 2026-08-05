const WINDOW_MS = 10 * 60 * 1000
const MAX_REQUESTS = 30
const CLEANUP_INTERVAL_MS = WINDOW_MS

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
let lastCleanupAt = 0

/** Drop every bucket whose window has elapsed. Runs at most once per interval. */
function pruneExpiredBuckets(now: number): void {
  for (const [bucketKey, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(bucketKey)
  }
  lastCleanupAt = now
}

export function checkRateLimit(key: string): { ok: true } | { ok: false; error: string } {
  const now = Date.now()

  if (now - lastCleanupAt >= CLEANUP_INTERVAL_MS) {
    pruneExpiredBuckets(now)
  }

  const bucket = buckets.get(key)

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { ok: true }
  }

  if (bucket.count >= MAX_REQUESTS) {
    return {
      ok: false,
      error: "Too many concierge requests. Please try again in a few minutes.",
    }
  }

  bucket.count += 1
  return { ok: true }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown"
  return request.headers.get("x-real-ip") ?? "unknown"
}
