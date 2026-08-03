type Entry = { count: number; reset: number };
const store = new Map<string, Entry>();

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key) ?? { count: 0, reset: now + windowMs };
  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + windowMs;
  }
  entry.count++;
  store.set(key, entry);
  return entry.count <= limit;
}

// Best-effort per-IP identifier for rate limiting. This store is in-memory
// per server instance, so it resets on cold start and isn't shared across
// instances — good enough to blunt casual scripted abuse, not a hard cap.
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
