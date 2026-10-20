import { HttpError } from "@/lib/http";

interface Bucket {
  count: number;
  resetAt: number;
}

const globalBuckets = globalThis as unknown as { __swizzrizzRateLimit?: Map<string, Bucket> };
function buckets() {
  if (!globalBuckets.__swizzrizzRateLimit) globalBuckets.__swizzrizzRateLimit = new Map();
  return globalBuckets.__swizzrizzRateLimit;
}

/**
 * Fixed-window limiter. Per server instance: on Netlify or Vercel each instance keeps its own
 * counters, so the effective limit is approximate. Swap in a shared store (for
 * example Upstash Redis) before scaling out. See SECURITY.md.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfter: number } {
  const map = buckets();
  if (map.size > 10_000) {
    for (const [k, b] of map) if (b.resetAt <= now) map.delete(k);
  }
  const b = map.get(key);
  if (!b || b.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  b.count += 1;
  return { ok: true, retryAfter: 0 };
}

export function enforceRateLimit(key: string, limit: number, windowMs = 60_000) {
  const r = checkRateLimit(key, limit, windowMs);
  if (!r.ok) throw new HttpError(429, "rate_limited", `Too many requests. Try again in ${r.retryAfter}s.`);
}
