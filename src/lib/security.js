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
 */
const actionBuckets = new Map(); // key -> { count, firstTs }

export function rateLimit(key, { max = 5, windowMs = 8000 } = {}) {
  const now = Date.now();
  const bucket = actionBuckets.get(key);
  if (!bucket) {
    actionBuckets.set(key, { count: 1, firstTs: now });
    return { allowed: true, remaining: max - 1 };
  }
  if (now - bucket.firstTs > windowMs) {
    actionBuckets.set(key, { count: 1, firstTs: now });
    return { allowed: true, remaining: max - 1 };
  }
  if (bucket.count >= max) {
    return { allowed: false, remaining: 0 };
  }
  bucket.count += 1;
  return { allowed: true, remaining: max - bucket.count };
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
