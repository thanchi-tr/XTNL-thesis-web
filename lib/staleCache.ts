/**
 * Minimal localStorage-backed stale-while-revalidate helper.
 *
 * For data that's expensive/slow to fetch but rarely changes (SOP
 * checklists, enforced-SOP sets — a strategist touches these maybe once
 * or twice a week), showing last-known-good instantly and reconciling in
 * the background beats a loading spinner every single visit. Safe to call
 * on the server (no-ops) since Next.js may render this on first pass.
 */
export function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded / private-browsing storage block — non-fatal, just skip caching */
  }
}
