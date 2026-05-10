/**
 * /api/voice/transcribe — Quality Fix Phase 2.
 *
 * POST multipart/form-data { audio: Blob, language: 'en'|'ar', child_id: uuid }
 *   → 200 { transcript, language_detected, duration_seconds, cost_usd }
 *   → 429 { error: 'cap_reached', remainingUsd, monthlyCapUsd }
 *   → 400 { error: 'invalid_input', detail }
 *   → 503 { error: 'voice_unavailable', detail }
 *
 * Server-side OpenAI Whisper (whisper-1). Browser SpeechRecognition is
 * GONE — when the key is missing OR the cap is reached, the caller
 * shows a friendly disabled state on the hold-to-speak button. NEVER
 * falls back to browser STT.
 *
 * Audio constraints:
 *   • Captured by browser MediaRecorder at 16kHz mono opus/webm.
 *   • Hard cap 5 seconds on the client; server caps at 25MB / 1 minute
 *     of audio as a defense-in-depth check.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { transcribe } from '@/lib/voice';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_AUDIO_BYTES = 5 * 1024 * 1024; // 5MB — generous for a 5-second clip

function badRequest(detail: string) {
  return NextResponse.json({ error: 'invalid_input', detail }, { status: 400 });
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

    const audioBuf = Buffer.from(await audioField.arrayBuffer());
    const audioMime = audioField.type || 'audio/webm';
    const result = await transcribe({
      audio: audioBuf,
      audioMime,
      language,
      childId,
      supabaseAdmin: supabaseAdmin as never,
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
    return NextResponse.json({
      transcript: result.result.transcript,
      language_detected: result.result.language_detected,
      duration_seconds: result.result.duration_seconds,
      cost_usd: result.result.cost_usd,
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
