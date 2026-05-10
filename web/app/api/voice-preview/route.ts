import { NextResponse, type NextRequest } from 'next/server';
import { mockSpeak } from '@/lib/voice/mock';

/**
 * Voice preview endpoint for the onboarding wizard's voice-selection
 * step. Returns a small WAV produced by the mock provider until the real
 * ElevenLabs/Azure SDK calls land in Module 9.
 *
 * Cost guard isn't applied here because the mock provider doesn't charge —
 * the real provider integration in Module 9 will add the guard wrap and
 * the per-session 3-preview cap.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id') ?? 'voice-warm';
  // We don't need the supabase client for the mock — pass undefined-as-any
  // so the type narrows. Real provider call sites use the full input.
  const result = await mockSpeak({
    text: 'BlueCare. ' + id,
    locale: 'en',
    voiceId: id,
    childId: 'preview',
    supabase: undefined as never,
  });
  // The mock returns a data: URL; redirect there.
  return NextResponse.redirect(result.audioUrl);
}
