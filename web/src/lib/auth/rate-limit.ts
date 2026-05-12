/**
 * Per-IP sliding-window rate limit for auth endpoints.
 *
 * Two backends:
 *   • Persistent: Upstash Redis (UPSTASH_REDIS_REST_URL + _TOKEN). Used when
 *     configured. Survives Vercel cold starts + spans all instances.
 *   • In-memory: process-local Map. Used as fallback when Upstash env is
 *     missing. Best-effort across warm Vercel instances; resets on cold start.
 *
 * Two presets so signup and login can have different policies:
 *   signup : 5 attempts / 10 minutes
 *   login  : 10 attempts / 10 minutes
 */

import { Redis } from '@upstash/redis';

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

let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

/** Returns true when the request EXCEEDS the limit (should be rejected). */
async function checkAsync(bucket: Bucket, key: string, ip: string): Promise<boolean> {
  const r = getRedis();
  if (r) {
    // Sliding window via Redis ZSET. Each request: trim old entries, count, add.
    const now = Date.now();
    const zsetKey = `rl:${key}:${ip}`;
    const cutoff = now - bucket.windowMs;
    try {
      // Pipeline: ZREMRANGEBYSCORE + ZADD + ZCARD + EXPIRE.
      const pipe = r.pipeline();
      pipe.zremrangebyscore(zsetKey, 0, cutoff);
      pipe.zadd(zsetKey, { score: now, member: `${now}-${Math.random()}` });
      pipe.zcard(zsetKey);
      pipe.expire(zsetKey, Math.ceil(bucket.windowMs / 1000));
      const results = (await pipe.exec()) as unknown[];
      // results[2] is the ZCARD count after ZADD.
      const count = Number(results[2] ?? 0);
      return count > bucket.max;
    } catch {
      // Redis hiccup — fall through to in-memory so we never lock out users
      // on a transient Upstash outage.
    }
  }
  const now = Date.now();
  const arr = (bucket.hits.get(ip) ?? []).filter((t) => now - t < bucket.windowMs);
  arr.push(now);
  bucket.hits.set(ip, arr);
  return arr.length > bucket.max;
}

export const rateLimitSignup = (ip: string): Promise<boolean> => checkAsync(SIGNUP, 'signup', ip);
export const rateLimitLogin = (ip: string): Promise<boolean> => checkAsync(LOGIN, 'login', ip);

export function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}
