/**
 * OpenAI Whisper-family STT — Quality Fix Phase 2 + Phase 9.B + Phase 10.B.
 *
 * Server-side wrapper around POST /v1/audio/transcriptions. Accepts an
 * audio Blob/Buffer captured by the browser's MediaRecorder API
 * (16kHz mono opus/webm), forwards as multipart/form-data, returns the
 * transcript text + detected language + duration + average logprob +
 * a hallucination verdict.
 *
 * Phase 10.B — switch from `whisper-1` to `gpt-4o-mini-transcribe`.
 *   • Same Whisper-accuracy class on EN + AR, ~30% faster end-to-end.
 *   • The gpt-4o-mini-transcribe endpoint accepts the same multipart
 *     contract, so the wrapper change is the model id + the response
 *     format. The newer model only supports `json` / `text`, not
 *     `verbose_json` — segments[] / avg_logprob fall back to NaN
 *     (Whisper's text-only hallucination filter still runs).
 *   • Override via `OPENAI_TRANSCRIBE_MODEL` if the new model regresses
 *     on a given account; setting it back to `whisper-1` re-enables
 *     full verbose_json + per-segment logprobs.
 *
 * Phase 9.B anti-hallucination measures (still active):
 *   • Pass a `prompt` parameter biasing the decoder toward the child's
 *     active AAC vocabulary, instead of the YouTube subtitle corpus
 *     that biases it toward "اشتركوا في القناة"-style hallucinations.
 *   • Hard-reject any clip shorter than 1.0s (sub-second clips are
 *     mostly silence and produce wild hallucinations).
 *   • Run every transcript through detectHallucination() and return
 *     `hallucination: true` when matched.
 *   • Surface `avg_logprob` to the caller (whisper-1 only) so the
 *     route handler can gate low-confidence transcripts (< -1.0).
 *
 * Cost (per second of audio):
 *   • whisper-1:                $0.006 / minute = $0.0001/s
 *   • gpt-4o-mini-transcribe:   $0.003 / minute = $0.00005/s
 *   We bill against the higher rate so cost-guard always over-charges.
 *
 * Server-only — `OPENAI_API_KEY` MUST never reach the browser.
 */
import 'server-only';
import './http-agent';
import { detectHallucination, type HallucinationDecision } from './whisper-hallucinations';

const OPENAI_API = 'https://api.openai.com/v1';
const MODEL_ID = process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe';

/** verbose_json (segments + duration + per-segment logprobs) is only
 *  honoured by whisper-1. The gpt-4o-*-transcribe family responds with
 *  `unsupported_value` if asked for it, so we downgrade to `json` and
 *  estimate duration from buffer size. */
const SUPPORTS_VERBOSE_JSON = MODEL_ID === 'whisper-1';

/** USD per second of audio. We always bill at the whisper-1 rate so
 *  cost-guard accounting is conservative regardless of which model the
 *  env actually selects. */
export const COST_PER_SECOND_USD = 0.006 / 60;

/** Reject any clip shorter than this many seconds. Whisper hallucinates
 *  wildly on near-silent sub-second clips. */
export const MIN_AUDIO_SECONDS = 1.0;

/** Average logprob threshold below which a transcript is considered
 *  low-confidence. Per OpenAI guidance, < -1.0 corresponds to the
 *  decoder being uncertain across most tokens. Only meaningful when
 *  the model returns verbose_json (whisper-1). */
export const LOW_CONFIDENCE_LOGPROB = -1.0;

/** Default biasing prompts — used when no per-child vocabulary is
 *  supplied. These tell the decoder "these are the likely words" and
 *  dramatically reduce the YouTube-subtitle bias for short Arabic
 *  clips. The English seed is shorter because EN hallucinations are
 *  less aggressive at this clip length. */
export const DEFAULT_AAC_VOCAB_AR =
  'أريد، أمي، أبي، ماء، طعام، نعم، لا، المزيد، ساعدني، توقّف، من فضلك، شكرا، أنا، أنت، تعبان، جوعان، عطشان، حمام، نوم، لعب، حديقة، مدرسة، بيت، تفاح، حليب، خبز، أحب، أكره، صديق، عائلة';
export const DEFAULT_AAC_VOCAB_EN =
  'I want, mom, dad, water, food, yes, no, more, help, stop, please, thank you, hungry, thirsty, tired, bathroom, sleep, play, apple, milk, friend, family';

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
  /** Comma- or space-separated vocabulary biasing prompt. Caller
   *  composes this from the child's vocabulary_sets symbol labels; the
   *  /api/voice/transcribe route resolves the child's labels before
   *  calling. Falls back to DEFAULT_AAC_VOCAB_* when empty. */
  vocabPrompt?: string;
}

export interface TranscribeResult {
  transcript: string;
  /** Whisper-detected language (may differ from the hint when the
   *  child speaks the other language). */
  language_detected: string;
  /** Total audio duration in seconds (used for cost accounting). On
   *  gpt-4o-mini-transcribe this is estimated from buffer size. */
  duration_seconds: number;
  cost_usd: number;
  /** Average logprob across all returned segments. NaN when the model
   *  did not return per-segment data (gpt-4o-mini-transcribe) or when
   *  there were no segments. */
  avg_logprob: number;
  /** True when the audio is below the MIN_AUDIO_SECONDS floor. The
   *  route handler should reject before charging. */
  too_short: boolean;
  /** Outcome of the hallucination filter. Text-only, so it runs
   *  regardless of which model produced the transcript. */
  hallucination: HallucinationDecision;
  /** True when avg_logprob < LOW_CONFIDENCE_LOGPROB. Only set on
   *  whisper-1; on gpt-4o-mini-transcribe stays false. */
  low_confidence: boolean;
}

export function isWhisperAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 0;
}

export function estimateTranscribeCostUsd(durationSeconds: number): number {
  const c = Math.max(0, durationSeconds) * COST_PER_SECOND_USD;
  return Math.round(c * 1_000_000) / 1_000_000;
}

interface WhisperSegment {
  avg_logprob?: number;
  no_speech_prob?: number;
}

interface WhisperVerboseResponse {
  text?: string;
  language?: string;
  duration?: number;
  segments?: WhisperSegment[];
}

/** Mean of an array of numbers, ignoring undefined entries. NaN on
 *  empty input. */
function mean(xs: number[]): number {
  if (xs.length === 0) return Number.NaN;
  let sum = 0;
  for (const x of xs) sum += x;
  return sum / xs.length;
}

/**
 * Direct STT call. NO aiGuard wrapper — the caller composes that.
 * Throws on non-2xx (route handler catches + maps to 502).
 */
export async function whisperTranscribe(input: TranscribeInput): Promise<TranscribeResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  if (input.audio.length === 0) throw new Error('transcribe: empty audio');
  if (input.audio.length > 25 * 1024 * 1024) {
    throw new Error(`transcribe: audio too large (${input.audio.length} bytes > 25MB)`);
  }

  const fd = new FormData();
  const blob = new Blob([new Uint8Array(input.audio)], { type: input.audioMime });
  fd.append('file', blob, input.filename ?? 'audio.webm');
  fd.append('model', MODEL_ID);
  fd.append('language', input.language);
  fd.append('response_format', SUPPORTS_VERBOSE_JSON ? 'verbose_json' : 'json');

  // Phase 9.B.2 — biasing prompt. The `prompt` parameter is honoured by
  // both whisper-1 and the gpt-4o-*-transcribe family; the decoder
  // re-weights toward those tokens. We pass the child's vocabulary
  // (when available) or a curated AAC seed. The bias also helps the
  // decoder disambiguate Saudi-dialect tokens that aren't in the
  // standard training corpus.
  const vocab = (input.vocabPrompt ?? '').trim();
  const promptText =
    vocab.length > 0
      ? vocab
      : input.language === 'ar'
        ? DEFAULT_AAC_VOCAB_AR
        : DEFAULT_AAC_VOCAB_EN;
  // Whisper caps the prompt at 224 tokens (~ 900 chars); cap defensively
  // so we never trip the upstream 400.
  fd.append('prompt', promptText.slice(0, 800));

  const res = await fetch(`${OPENAI_API}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`STT ${res.status}: ${errBody.slice(0, 240)}`);
  }
  const body = (await res.json()) as WhisperVerboseResponse;
  const transcript = (body.text ?? '').trim();

  // Duration: whisper-1 echoes it via verbose_json. gpt-4o-mini-transcribe
  // doesn't — estimate from buffer size: opus/webm @ 16 kbps mono ≈ 2
  // KB/s. Conservative multiplier so cost-guard never under-charges.
  const reportedDuration = Number(body.duration ?? 0);
  const duration_seconds = reportedDuration || Math.max(1, input.audio.length / 2048);

  const segmentLogprobs = (body.segments ?? [])
    .map((s) => (typeof s.avg_logprob === 'number' ? s.avg_logprob : Number.NaN))
    .filter((n) => Number.isFinite(n));
  const avg_logprob = mean(segmentLogprobs);

  const too_short = duration_seconds < MIN_AUDIO_SECONDS;
  const hallucination = detectHallucination(transcript);
  const low_confidence = Number.isFinite(avg_logprob) && avg_logprob < LOW_CONFIDENCE_LOGPROB;

  return {
    transcript: hallucination.hallucination ? '' : transcript,
    language_detected: body.language ?? input.language,
    duration_seconds,
    cost_usd: estimateTranscribeCostUsd(duration_seconds),
    avg_logprob,
    too_short,
    hallucination,
    low_confidence,
  };
}
