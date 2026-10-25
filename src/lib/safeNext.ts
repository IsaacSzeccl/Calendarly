/**
 * Where to send someone after sign-in: only a path on this same site.
 * Resolving and comparing origins catches tricks like "/\evil.com".
 */
export function safeNext(raw: string | null, requestUrl: string, fallback = "/new"): string {
  if (!raw) return fallback;
  try {
    const base = new URL(requestUrl);
    const target = new URL(raw, base);
    return target.origin === base.origin ? `${target.pathname}${target.search}` : fallback;
  } catch {
    return fallback;
  }
}
