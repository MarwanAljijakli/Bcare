/**
 * TTS audio cache — Quality Fix Phase 2.
 *
 * SHA-256-keyed lookup against the `tts-cache` Supabase Storage bucket.
 * Cache hit returns the public URL of the MP3 with zero ElevenLabs spend
 * and ~50ms latency (CDN-fronted). Cache miss returns null so the caller
 * can fall through to a synthesize call + putCachedAudio() write-back.
 *
 * Hash input: `${language}:${voice_id}:${speed}:${text.toLowerCase().trim()}`.
 * The lowercase + trim are intentional — TTS pronunciation does not vary
 * with case or surrounding whitespace, and case-insensitive matching
 * boosts the hit rate for the same phrase typed by different children.
 *
 * Cache hit rate target: ≥ 60% over a 30-day window. Without it, the
 * ElevenLabs line item balloons; the live `/api/health/voice` endpoint
 * exposes the rolling 30d hit rate so we can spot regressions.
 */
import 'server-only';
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'tts-cache';
const PREFIX = 'tts/';

export interface CacheKeyInput {
  language: 'en' | 'ar';
  voice_id: string;
  speed: number;
  text: string;
}

export interface CachedAudio {
  url: string;
  /** Object path inside the bucket. Use for direct deletion / inspection. */
  objectPath: string;
}

/** Deterministic hash for the cache key. Lowercase + trim before hashing. */
export function computeCacheKey(input: CacheKeyInput): string {
  const normalized = `${input.language}:${input.voice_id}:${input.speed.toFixed(2)}:${input.text.trim().toLowerCase()}`;
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/** Object path inside the tts-cache bucket. */
function pathFor(hash: string): string {
  return `${PREFIX}${hash}.mp3`;
}

/**
 * Look up cached MP3. Returns the public URL on hit, null on miss.
 *
 * Implementation: HEAD the storage object via the public URL since the
 * bucket is public-read. We don't need the storage SDK's signed-URL
 * machinery here, and avoiding it shaves 60ms off the hit path.
 */
export async function getCachedAudio(
  supabaseAdmin: SupabaseClient<never>,
  hash: string,
): Promise<CachedAudio | null> {
  const objectPath = pathFor(hash);
  const publicRes = supabaseAdmin.storage.from(BUCKET).getPublicUrl(objectPath);
  const url = publicRes.data?.publicUrl;
  if (!url) return null;
  // HEAD probe to confirm the object exists. The cdn returns 404 for
  // missing keys + 200 for present.
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok) return { url, objectPath };
  } catch {
    /* network blip — treat as miss, fall through to synthesize */
  }
  return null;
}

/** Upload an MP3 buffer + return the public URL. */
export async function putCachedAudio(
  supabaseAdmin: SupabaseClient<never>,
  hash: string,
  mp3: Buffer,
): Promise<CachedAudio> {
  const objectPath = pathFor(hash);
  const up = await supabaseAdmin.storage.from(BUCKET).upload(objectPath, mp3, {
    contentType: 'audio/mpeg',
    upsert: true,
    cacheControl: '604800', // 7 days CDN cache for cache hits
  });
  if (up.error) throw new Error(`tts-cache upload failed: ${up.error.message}`);
  const publicRes = supabaseAdmin.storage.from(BUCKET).getPublicUrl(objectPath);
  const url = publicRes.data?.publicUrl;
  if (!url) throw new Error('tts-cache upload succeeded but getPublicUrl returned empty');
  return { url, objectPath };
}

/**
 * Aggregate cache stats over the last 30 days. Used by /api/health/voice
 * to surface the cache-hit-rate metric.
 *
 * Counts ai_usage_ledger rows where service='elevenlabs_tts' and the
 * unit count is 0 (cache hit; pre-charge was reverted) vs non-zero
 * (cache miss; full synthesis charged). Returns the ratio + raw counts.
 */
export async function cacheStats30d(supabaseAdmin: SupabaseClient<never>): Promise<{
  ttsCalls: number;
  ttsCacheHits: number;
  ttsCacheHitRate: number;
}> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const res = await (
    supabaseAdmin.from('ai_usage_ledger') as never as {
      select: (cols: string) => {
        eq: (
          col: string,
          v: string,
        ) => {
          gte: (
            col: string,
            v: string,
          ) => Promise<{
            data: { units: number; cost_usd: number }[] | null;
          }>;
        };
      };
    }
  )
    .select('units, cost_usd')
    .eq('service', 'elevenlabs_tts')
    .gte('created_at', since);
  const rows = res.data ?? [];
  const calls = rows.length;
  // Cache hits are recorded as $0 cost rows (we still book the call so
  // we can compute hit rate without a separate metric table).
  const hits = rows.filter((r) => Number(r.cost_usd ?? 0) === 0).length;
  return {
    ttsCalls: calls,
    ttsCacheHits: hits,
    ttsCacheHitRate: calls > 0 ? hits / calls : 0,
  };
}
