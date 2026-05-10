/**
 * OpenAI Whisper STT (whisper-1) — Quality Fix Phase 2.
 *
 * Server-side wrapper around POST /v1/audio/transcriptions. Accepts an
 * audio Blob/Buffer captured by the browser's MediaRecorder API
 * (16kHz mono opus/webm), forwards as multipart/form-data, returns the
 * transcript text + detected language + duration.
 *
 * Why Whisper (per Quality Fix override):
 *   • Best-in-class Arabic STT, Saudi-dialect aware, handles short
 *     utterances reliably. Browser SpeechRecognition was Chromium-only
 *     and had poor Arabic accuracy — that path is DELETED forever.
 *
 * Cost: $0.006 / minute of audio. The 5-second hold-to-speak cap on
 * the board means each call is ≤ 0.083 minutes ≈ $0.0005.
 *
 * Server-only — `OPENAI_API_KEY` MUST never reach the browser.
 */
import 'server-only';

const OPENAI_API = 'https://api.openai.com/v1';
const MODEL_ID = 'whisper-1';

/** USD per second of audio. */
export const COST_PER_SECOND_USD = 0.006 / 60;

export interface TranscribeInput {
  audio: Buffer;
  /** MIME type of the audio buffer (e.g. 'audio/webm', 'audio/mp4'). */
  audioMime: string;
  /** Hint to Whisper for better accuracy. */
  language: 'en' | 'ar';
  /** Filename hint Whisper uses to dispatch the codec. Defaults to
   *  `audio.webm`. The actual extension matters less than the MIME, but
   *  a sensible filename improves response in some edge cases. */
  filename?: string;
}

export interface TranscribeResult {
  transcript: string;
  /** Whisper-detected language (may differ from the hint when the
   *  child speaks the other language). */
  language_detected: string;
  /** Total audio duration in seconds (used for cost accounting). */
  duration_seconds: number;
  cost_usd: number;
}

export function isWhisperAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 0;
}

export function estimateTranscribeCostUsd(durationSeconds: number): number {
  const c = Math.max(0, durationSeconds) * COST_PER_SECOND_USD;
  return Math.round(c * 1_000_000) / 1_000_000;
}

/**
 * Direct Whisper call. NO aiGuard wrapper — the caller composes that.
 * Throws on non-2xx (route handler catches + maps to 502).
 */
export async function whisperTranscribe(input: TranscribeInput): Promise<TranscribeResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  if (input.audio.length === 0) throw new Error('transcribe: empty audio');
  if (input.audio.length > 25 * 1024 * 1024) {
    // Whisper's hard limit is 25MB; reject earlier to fail fast.
    throw new Error(`transcribe: audio too large (${input.audio.length} bytes > 25MB)`);
  }

  // FormData with a Blob — Node 18+ has native FormData/Blob.
  const fd = new FormData();
  const blob = new Blob([new Uint8Array(input.audio)], { type: input.audioMime });
  fd.append('file', blob, input.filename ?? 'audio.webm');
  fd.append('model', MODEL_ID);
  fd.append('language', input.language);
  fd.append('response_format', 'verbose_json'); // returns duration + language

  const res = await fetch(`${OPENAI_API}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Whisper ${res.status}: ${errBody.slice(0, 240)}`);
  }
  const body = (await res.json()) as {
    text?: string;
    language?: string;
    duration?: number;
  };
  const transcript = (body.text ?? '').trim();
  const duration_seconds = Number(body.duration ?? 0);
  return {
    transcript,
    language_detected: body.language ?? input.language,
    duration_seconds,
    cost_usd: estimateTranscribeCostUsd(duration_seconds),
  };
}
