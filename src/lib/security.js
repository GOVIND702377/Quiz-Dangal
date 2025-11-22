// Frontend-only lightweight security & safety helpers (no backend changes required)
// All functions are side-effect free utilities.

/**
 * Escape a string for safe interpolation into HTML (defense-in-depth if ever dangerouslySetInnerHTML is needed).
 */
export function escapeHTML(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Simple in-memory rate limiter for user-triggered actions (e.g. join/pre-join spam protection on client side).
 * Not a security boundary (still rely on backend validation) but reduces accidental hammering.
 * Buckets are periodically pruned to avoid unbounded memory growth.
 */
const actionBuckets = new Map(); // key -> { count, firstTs, windowMs }
let rateLimitCalls = 0;

function pruneBuckets(now) {
  // Only prune when map grows or every ~200 calls to keep overhead tiny.
  if (rateLimitCalls % 200 !== 0 && actionBuckets.size < 100) return;
  for (const [k, v] of actionBuckets.entries()) {
    const ttl = (v.windowMs || 8000) * 2; // keep a little longer than window for burst patterns
    if (now - v.firstTs > ttl) actionBuckets.delete(k);
  }
}

export function rateLimit(key, { max = 5, windowMs = 8000 } = {}) {
  rateLimitCalls += 1;
  const now = Date.now();
  const bucket = actionBuckets.get(key);
  if (!bucket) {
    actionBuckets.set(key, { count: 1, firstTs: now, windowMs });
    pruneBuckets(now);
    return { allowed: true, remaining: max - 1 };
  }
  if (now - bucket.firstTs > bucket.windowMs) {
    actionBuckets.set(key, { count: 1, firstTs: now, windowMs });
    pruneBuckets(now);
    return { allowed: true, remaining: max - 1 };
  }
  if (bucket.count >= max) {
    pruneBuckets(now);
    return { allowed: false, remaining: 0 };
  }
  bucket.count += 1;
  pruneBuckets(now);
  return { allowed: true, remaining: max - bucket.count };
}

/** Reset the rate limit bucket for a given key (primarily for tests). */
export function resetRateLimit(key) {
  actionBuckets.delete(key);
}

/** Clear all rate limit buckets (primarily for tests / diagnostics). */
export function resetAllRateLimits() {
  actionBuckets.clear();
}

/**
 * Debounce a function (micro util used where needed – avoids pulling an external lib).
 */
export function debounce(fn, delay = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}
