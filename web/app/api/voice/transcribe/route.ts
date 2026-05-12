/**
 * /api/voice/transcribe — Quality Fix Phase 2 + Phase 9.B.
 *
 * POST multipart/form-data { audio: Blob, language: 'en'|'ar', child_id: uuid }
 *   → 200 { transcript, language_detected, duration_seconds, cost_usd,
 *           avg_logprob, low_confidence, hallucination_detected }
 *   → 200 { transcript: null, reason: 'too_short' | 'hallucination_detected'
 *           | 'low_confidence', ... }      // graceful rejection
 *   → 429 { error: 'cap_reached', remainingUsd, monthlyCapUsd }
 *   → 400 { error: 'invalid_input', detail }
 *   → 503 { error: 'voice_unavailable', detail }
 *
 * Server-side OpenAI Whisper (whisper-1). Browser SpeechRecognition is
 * GONE — when the key is missing OR the cap is reached, the caller
 * shows a friendly disabled state on the hold-to-speak button. NEVER
 * falls back to browser STT.
 *
 * Phase 9.B anti-hallucination measures owned by this route:
 *   • Pre-flight payload-size sanity check (drop trivially tiny clips
 *     before charging Whisper).
 *   • Resolve the child's active vocabulary_sets symbol labels and
 *     pass them as the biasing `prompt` to whisper-1. This re-weights
 *     the decoder toward the child's actual AAC vocabulary and away
 *     from the YouTube-subtitle corpus that produces "اشتركوا في القناة".
 *   • Post-flight: when Whisper returns a clip shorter than the
 *     MIN_AUDIO_SECONDS floor OR avg_logprob < LOW_CONFIDENCE_LOGPROB
 *     OR the hallucination filter matched a known bad pattern, surface
 *     a typed graceful-rejection 200 with `transcript: null` and a
 *     `reason` so the UI can show "We couldn't hear you clearly".
 *
 * Audio constraints:
 *   • Captured by browser MediaRecorder at 16kHz mono opus/webm.
 *   • Hard cap 8 seconds on the client (Phase 9.B.5); server caps at
 *     5MB / 25MB / 1 minute of audio as defense-in-depth.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { transcribe } from '@/lib/voice';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_AUDIO_BYTES = 8 * 1024 * 1024; // 8MB — generous for an 8-second clip
/** Below this size, the buffer is almost certainly silence + container
 *  overhead. Reject before charging Whisper. Calibrated against opus/
 *  webm at 16 kHz mono: a 1-second clip with real speech is ≥ 3 KB. */
const MIN_AUDIO_BYTES = 2 * 1024;

function badRequest(detail: string) {
  return NextResponse.json({ error: 'invalid_input', detail }, { status: 400 });
}

/** Resolve the child's active vocabulary labels in the requested
 *  language. Returns a Whisper-friendly comma-separated biasing prompt.
 *  Returns empty string on any error; whisperTranscribe() falls back
 *  to a curated AAC seed when the prompt is empty. */
async function resolveVocabPrompt(
  supabase: unknown,
  childId: string,
  language: 'en' | 'ar',
): Promise<string> {
  try {
    interface VocabRow {
      symbol_id: string;
    }
    interface SymbolRow {
      id: string;
      label_en: string | null;
      label_ar: string | null;
    }
    const vocabRes = (await (
      supabase as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (
              col: string,
              v: string,
            ) => {
              order: (
                col: string,
                opts: { ascending: boolean },
              ) => { limit: (n: number) => Promise<{ data: VocabRow[] | null }> };
            };
          };
        };
      }
    )
      .from('vocabulary_sets')
      .select('symbol_id')
      .eq('child_id', childId)
      .order('frequency', { ascending: false })
      .limit(80)) as { data: VocabRow[] | null };
    const symbolIds = (vocabRes.data ?? []).map((r) => r.symbol_id).filter(Boolean);
    if (symbolIds.length === 0) return '';
    const symRes = (await (
      supabase as {
        from: (t: string) => {
          select: (cols: string) => {
            in: (col: string, vs: string[]) => Promise<{ data: SymbolRow[] | null }>;
          };
        };
      }
    )
      .from('symbols')
      .select('id, label_en, label_ar')
      .in('id', symbolIds)) as { data: SymbolRow[] | null };
    const labels = (symRes.data ?? [])
      .map((r) => (language === 'ar' ? r.label_ar : r.label_en))
      .filter((l): l is string => typeof l === 'string' && l.length > 0);
    if (labels.length === 0) return '';
    return labels.slice(0, 80).join('، ');
  } catch {
    return '';
  }
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest('body must be multipart/form-data');
  }
  const audioField = form.get('audio');
  const language = form.get('language')?.toString();
  const childId = form.get('child_id')?.toString();
  if (!(audioField instanceof Blob)) return badRequest('audio (Blob) required');
  if (language !== 'en' && language !== 'ar') return badRequest('language must be en|ar');
  if (typeof childId !== 'string' || childId.length === 0) return badRequest('child_id required');
  if (audioField.size === 0) return badRequest('audio is empty');
  if (audioField.size > MAX_AUDIO_BYTES) return badRequest('audio too large');
  // Phase 9.B.1 / 9.B.4 — pre-flight gate: trivially small payloads
  // mean near-silent recordings. Reject before charging Whisper.
  if (audioField.size < MIN_AUDIO_BYTES) {
    return NextResponse.json(
      {
        transcript: null,
        reason: 'too_short',
        detail:
          language === 'ar'
            ? 'لم نستطع سماعك بوضوح، حاول مرة أخرى وتحدث لمدة ثانية على الأقل.'
            : "We couldn't hear you clearly, please try again and speak for at least 1 second.",
      },
      { status: 200 },
    );
  }

  try {
    const { createSupabaseServerClient, createSupabaseAdminClient } =
      await import('@/lib/supabase/server');
    const supabase = await createSupabaseServerClient();
    const supabaseAdmin = createSupabaseAdminClient();

    const { data: childRow } = await (
      supabase.from('children') as never as {
        select: (cols: string) => {
          eq: (
            col: string,
            v: string,
          ) => {
            maybeSingle: () => Promise<{ data: { id: string } | null }>;
          };
        };
      }
    )
      .select('id')
      .eq('id', childId)
      .maybeSingle();
    if (!childRow) return NextResponse.json({ error: 'not_authorized' }, { status: 403 });

    // Phase 9.B.2 — biasing prompt resolved from the child's active
    // vocabulary. Best-effort: if the lookup fails the wrapper falls
    // back to the curated AAC seed prompt.
    const vocabPrompt = await resolveVocabPrompt(supabaseAdmin, childId, language);

    const audioBuf = Buffer.from(await audioField.arrayBuffer());
    const audioMime = audioField.type || 'audio/webm';
    const result = await transcribe({
      audio: audioBuf,
      audioMime,
      language,
      childId,
      supabaseAdmin: supabaseAdmin as never,
      vocabPrompt,
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.reason,
          remainingUsd: result.remainingUsd,
          monthlyCapUsd: result.monthlyCapUsd,
        },
        { status: 429 },
      );
    }

    // Phase 9.B post-flight gates. Whisper has already been called and
    // billed (the cost row is logged for transparency), but we surface
    // a graceful 200 with `transcript: null` so the UI can prompt the
    // user to try again instead of acting on a bogus transcript.
    if (result.result.too_short) {
      return NextResponse.json({
        transcript: null,
        reason: 'too_short',
        duration_seconds: result.result.duration_seconds,
        cost_usd: result.result.cost_usd,
        detail:
          language === 'ar'
            ? 'لم نستطع سماعك بوضوح، حاول مرة أخرى وتحدث لمدة ثانية على الأقل.'
            : "We couldn't hear you clearly, please try again and speak for at least 1 second.",
      });
    }
    if (result.result.hallucination_detected) {
      return NextResponse.json({
        transcript: null,
        reason: 'hallucination_detected',
        hallucination_reason: result.result.hallucination_reason,
        duration_seconds: result.result.duration_seconds,
        cost_usd: result.result.cost_usd,
        detail:
          language === 'ar'
            ? 'لم نستطع التعرف على ما قلته. يرجى المحاولة مرة أخرى.'
            : "We couldn't make out what you said. Please try again.",
      });
    }
    if (result.result.low_confidence) {
      return NextResponse.json({
        transcript: result.result.transcript,
        reason: 'low_confidence',
        avg_logprob: result.result.avg_logprob,
        language_detected: result.result.language_detected,
        duration_seconds: result.result.duration_seconds,
        cost_usd: result.result.cost_usd,
        detail:
          language === 'ar'
            ? 'الإشارة ضعيفة — قد لا يكون النص دقيقًا.'
            : 'Low audio confidence — the transcript may be inaccurate.',
      });
    }
    return NextResponse.json({
      transcript: result.result.transcript,
      language_detected: result.result.language_detected,
      duration_seconds: result.result.duration_seconds,
      cost_usd: result.result.cost_usd,
      avg_logprob: result.result.avg_logprob,
      low_confidence: false,
      hallucination_detected: false,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown_error';
    if (message === 'voice_unavailable') {
      return NextResponse.json(
        {
          error: 'voice_unavailable',
          detail:
            'Voice service is not configured for this deployment. Admin needs to set OPENAI_API_KEY.',
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: 'transcribe_failed', detail: message.slice(0, 240) },
      { status: 502 },
    );
  }
}
