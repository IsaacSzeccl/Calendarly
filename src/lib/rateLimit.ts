/**
 * A small per-instance limiter for the one endpoint anyone can call that costs
 * a model call. Serverless instances don't share memory, so this slows abuse
 * rather than stopping it; a Vercel Firewall rate-limit rule is the stronger fix.
 */
const hits = new Map<string, number[]>();

export function allow(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return true;
}
