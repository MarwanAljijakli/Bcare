/**
 * Per-IP sliding-window rate limit for auth endpoints. In-memory; best-effort
 * across warm Vercel instances. Module 9 hardening swaps in a persistent
 * limiter (Upstash, pg-based, or Vercel KV).
 *
 * Two presets so signup and login can have different policies:
 *   signup : 5 attempts / 10 minutes
 *   login  : 10 attempts / 10 minutes
 */

interface Bucket {
  windowMs: number;
  max: number;
  hits: Map<string, number[]>;
}

function makeBucket(windowMs: number, max: number): Bucket {
  return { windowMs, max, hits: new Map() };
}

const SIGNUP = makeBucket(10 * 60 * 1000, 5);
const LOGIN = makeBucket(10 * 60 * 1000, 10);

function check(bucket: Bucket, ip: string): boolean {
  const now = Date.now();
  const arr = (bucket.hits.get(ip) ?? []).filter((t) => now - t < bucket.windowMs);
  arr.push(now);
  bucket.hits.set(ip, arr);
  return arr.length > bucket.max;
}

export const rateLimitSignup = (ip: string): boolean => check(SIGNUP, ip);
export const rateLimitLogin = (ip: string): boolean => check(LOGIN, ip);

export function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}
