/**
 * Voice cache pre-warming — Phase 10.A.
 *
 * The Tap-then-Speak path on the AAC board is bound by network latency to
 * ElevenLabs / OpenAI. A cache hit returns audio in <100 ms via Supabase
 * Storage's CDN; a miss waits 600-1500 ms while the upstream synthesizes.
 *
 * Pre-warming flips the default outcome: instead of cache being cold for
 * a brand-new child, we synthesize-and-cache the child's full active
 * vocabulary plus ~30 high-frequency conversational phrases at the
 * moment we know what the child will say (onboarding finalize, voice
 * change, custom symbol added, nightly idempotent sweep). Every call
 * runs through `aiGuard` so per-child caps still bind.
 *
 * Fire-and-forget contract:
 *   • These functions NEVER throw to the caller. On a partial failure,
 *     they log + continue. The board still works (cache miss = slow
 *     synthesize on first use, not a broken board).
 *   • Concurrency is throttled (5 parallel synth calls with a 100 ms
 *     stagger) so we don't blow through the ElevenLabs rate limit.
 *   • Idempotent: already-cached entries are detected by computing the
 *     cache key + HEADing the storage object; on a hit we skip the
 *     synth call entirely (no AI ledger row, no upstream cost).
 */
import 'server-only';
import { computeCacheKey, getCachedAudio } from './cache';
import { VOICE_IDS as ELEVENLABS_VOICE_IDS } from './elevenlabs';
import { OPENAI_TTS_VOICES, mapElevenLabsKeyToOpenAi } from './openai-tts';
import { speakWithFallback, type VoiceKey, type VoiceLocale } from './index';
import { primaryProvider } from './index';
import type { SupabaseClient } from '@supabase/supabase-js';

const BATCH_SIZE = 5;
const STAGGER_MS = 100;

/** Bilingual conversational phrases that every child gets pre-warmed.
 *  Pulled from observed top-of-strip patterns + the canonical AAC core
 *  vocabulary. Each entry is `[en, ar]`. */
export const COMMON_PHRASES: Array<[string, string]> = [
  ['I want', 'أريد'],
  ['I need', 'أحتاج'],
  ['more please', 'المزيد من فضلك'],
  ['thank you', 'شكرًا'],
  ['yes', 'نعم'],
  ['no', 'لا'],
  ['help me', 'ساعدني'],
  ["I'm tired", 'أنا متعب'],
  ["I'm hungry", 'أنا جائع'],
  ["I'm thirsty", 'أنا عطشان'],
  ['I love you', 'أحبك'],
  ['hello', 'مرحبًا'],
  ['goodbye', 'وداعًا'],
  ['please', 'من فضلك'],
  ['stop', 'توقف'],
  ['go', 'اذهب'],
  ['done', 'انتهيت'],
  ['all done', 'انتهيت تمامًا'],
  ['mama', 'ماما'],
  ['baba', 'بابا'],
  ['water', 'ماء'],
  ['food', 'طعام'],
  ['play', 'العب'],
  ['my turn', 'دوري'],
  ['your turn', 'دورك'],
  ['I feel happy', 'أشعر بالسعادة'],
  ['I feel sad', 'أشعر بالحزن'],
  ['too loud', 'عالٍ جدًا'],
  ['I want to go home', 'أريد الذهاب إلى المنزل'],
  ['I want to sleep', 'أريد أن أنام'],
];

interface PrewarmResult {
  attempted: number;
  cacheHits: number;
  synthesized: number;
  failed: number;
}

interface PrewarmTarget {
  text: string;
  locale: VoiceLocale;
}

interface PrewarmInput {
  supabaseAdmin: SupabaseClient<never>;
  childId: string;
  voice: VoiceKey;
  speed: number;
  targets: PrewarmTarget[];
}

/** Compute the cache hash for a given target + voice + provider so we can
 *  HEAD-probe storage without a synth call. */
function probeKey(target: PrewarmTarget, voice: VoiceKey, speed: number): string {
  const provider = primaryProvider();
  if (provider === 'elevenlabs') {
    return computeCacheKey({
      provider: 'elevenlabs',
      language: target.locale,
      voice_id: ELEVENLABS_VOICE_IDS[voice],
      speed,
      text: target.text,
    });
  }
  return computeCacheKey({
    provider: 'openai',
    language: target.locale,
    voice_id: OPENAI_TTS_VOICES[mapElevenLabsKeyToOpenAi(voice)],
    speed,
    text: target.text,
  });
}

/** Run a single pre-warm target through speakWithFallback. Cache hits
 *  short-circuit inside speakWithFallback — no upstream call, no charge. */
async function warmOne(
  input: PrewarmInput,
  target: PrewarmTarget,
): Promise<'hit' | 'synth' | 'fail'> {
  try {
    // Cheap HEAD check first so we can label hits accurately. If the
    // probe says hit, the speakWithFallback call would also be a hit —
    // we skip it to save an aiGuard write.
    const hash = probeKey(target, input.voice, input.speed);
    const cached = await getCachedAudio(input.supabaseAdmin, hash);
    if (cached) return 'hit';

    const res = await speakWithFallback({
      text: target.text,
      locale: target.locale,
      voice: input.voice,
      speed: input.speed,
      childId: input.childId,
      supabaseAdmin: input.supabaseAdmin,
    });
    if (!res.ok) return 'fail';
    return res.result.cacheHit ? 'hit' : 'synth';
  } catch {
    return 'fail';
  }
}

async function runInBatches(input: PrewarmInput, targets: PrewarmTarget[]): Promise<PrewarmResult> {
  const result: PrewarmResult = {
    attempted: targets.length,
    cacheHits: 0,
    synthesized: 0,
    failed: 0,
  };

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const slice = targets.slice(i, i + BATCH_SIZE);
    const outcomes = await Promise.all(slice.map((t) => warmOne(input, t)));
    for (const o of outcomes) {
      if (o === 'hit') result.cacheHits++;
      else if (o === 'synth') result.synthesized++;
      else result.failed++;
    }
    if (i + BATCH_SIZE < targets.length) {
      await new Promise<void>((r) => setTimeout(r, STAGGER_MS));
    }
  }
  return result;
}

/**
 * Synthesize-and-cache every label in the child's active vocabulary.
 * Caller MUST treat this as fire-and-forget — the promise resolves with
 * a summary but never rejects. Use `void prewarmChildVocabulary(...)`.
 */
export async function prewarmChildVocabulary(args: {
  supabaseAdmin: SupabaseClient<never>;
  childId: string;
  voice?: VoiceKey;
  speed?: number;
}): Promise<PrewarmResult> {
  const supabaseAdmin = args.supabaseAdmin;
  const voice = args.voice ?? 'charlotte';
  const speed = args.speed ?? 1.0;

  try {
    // Read every symbol referenced by the child's vocabulary_sets row,
    // pulling bilingual labels for both EN + AR.
    const vocab = await (
      supabaseAdmin.from('vocabulary_sets') as never as {
        select: (cols: string) => {
          eq: (
            col: string,
            v: string,
          ) => Promise<{
            data: { symbol_id: string }[] | null;
          }>;
        };
      }
    )
      .select('symbol_id')
      .eq('child_id', args.childId);
    const symbolIds = (vocab.data ?? []).map((v) => v.symbol_id).filter(Boolean);
    if (symbolIds.length === 0) {
      return { attempted: 0, cacheHits: 0, synthesized: 0, failed: 0 };
    }

    const symbolsRes = await (
      supabaseAdmin.from('symbols') as never as {
        select: (cols: string) => {
          in: (
            col: string,
            v: string[],
          ) => Promise<{
            data: { id: string; label_en: string; label_ar: string }[] | null;
          }>;
        };
      }
    )
      .select('id, label_en, label_ar')
      .in('id', symbolIds);
    const rows = symbolsRes.data ?? [];

    const targets: PrewarmTarget[] = [];
    for (const r of rows) {
      if (r.label_en) targets.push({ text: r.label_en, locale: 'en' });
      if (r.label_ar) targets.push({ text: r.label_ar, locale: 'ar' });
    }
    return runInBatches({ supabaseAdmin, childId: args.childId, voice, speed, targets }, targets);
  } catch {
    return { attempted: 0, cacheHits: 0, synthesized: 0, failed: 1 };
  }
}

/**
 * Pre-warm the bilingual COMMON_PHRASES set for a single child.
 * Fire-and-forget; never throws.
 */
export async function prewarmCommonPhrases(args: {
  supabaseAdmin: SupabaseClient<never>;
  childId: string;
  voice?: VoiceKey;
  speed?: number;
}): Promise<PrewarmResult> {
  const voice = args.voice ?? 'charlotte';
  const speed = args.speed ?? 1.0;
  const targets: PrewarmTarget[] = [];
  for (const [en, ar] of COMMON_PHRASES) {
    targets.push({ text: en, locale: 'en' });
    targets.push({ text: ar, locale: 'ar' });
  }
  return runInBatches(
    { supabaseAdmin: args.supabaseAdmin, childId: args.childId, voice, speed, targets },
    targets,
  );
}

/**
 * Pre-warm a SINGLE text+locale pair — used when the caregiver adds a
 * custom symbol so the first tap-to-speak is already cached.
 */
export async function prewarmSinglePhrase(args: {
  supabaseAdmin: SupabaseClient<never>;
  childId: string;
  text: string;
  locale: VoiceLocale;
  voice?: VoiceKey;
  speed?: number;
}): Promise<PrewarmResult> {
  return runInBatches(
    {
      supabaseAdmin: args.supabaseAdmin,
      childId: args.childId,
      voice: args.voice ?? 'charlotte',
      speed: args.speed ?? 1.0,
      targets: [{ text: args.text, locale: args.locale }],
    },
    [{ text: args.text, locale: args.locale }],
  );
}
