/**
 * Fixed-window in-memory rate limiter.
 *
 * Adequate for a single-region deployment and honest about its limits: for
 * multi-region you would swap the Map for Upstash/Redis behind this same
 * interface. Keys are hashed so raw IPs never sit in memory.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

function hash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number; limit: number };

export function rateLimit(identifier: string, limit: number, windowMs: number): RateLimitResult {
  const key = hash(identifier);
  const now = Date.now();

  if (buckets.size > MAX_KEYS) {
    for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
    if (buckets.size > MAX_KEYS) buckets.clear();
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt < now) {
    const bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, bucket);
    return { allowed: true, remaining: limit - 1, resetAt: bucket.resetAt, limit };
  }

  existing.count += 1;
  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    limit,
  };
}

/** Best-effort client identity from proxy headers. */
export function clientKey(req: Request, scope: string) {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = req.headers.get("x-real-ip");
  return `${scope}:${fwd || real || "anonymous"}`;
}
