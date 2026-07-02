interface Entry { count: number; resetAt: number }

const store = new Map<string, Entry>();

/**
 * Sliding-window rate limiter keyed on an arbitrary string (e.g. "totp:user@example.com").
 * In-memory only — resets on cold start. Suitable for auth endpoints where the goal
 * is to slow brute-force, not guarantee perfect persistence across deploys.
 */
export function checkRateLimit(
  key: string,
  maxCount: number,
  windowMs: number,
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  let entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }

  entry.count++;

  if (entry.count > maxCount) {
    return { ok: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }

  // Lazy cleanup when store grows large
  if (store.size > 500) {
    for (const [k, v] of store) {
      if (now >= v.resetAt) store.delete(k);
    }
  }

  return { ok: true, retryAfterSec: 0 };
}
