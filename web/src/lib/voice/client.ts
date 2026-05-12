'use client';
/**
 * Browser-side voice client — Quality Fix Phase 2.
 *
 * Talks to /api/voice/synthesize and /api/voice/transcribe. Replaces
 * browser-tts.ts (SpeechSynthesis) and browser-stt.ts
 * (SpeechRecognition), which are DELETED forever per the Quality Fix
 * directive. NEVER falls back to those APIs.
 *
 * The shape is intentionally similar to the old helpers so callers
 * (board-client.tsx) only need to swap imports + pass child_id.
 *
 * Behavior on cap-reached / voice_unavailable:
 *   • `speakClient()` rejects with `{ kind: 'cap_reached' | 'voice_unavailable' }`.
 *     The board UI catches this and shows a calm bilingual disabled
 *     state (or the pre-recorded "voice limit reached" clip when
 *     that's wired in Phase 6).
 *   • `transcribeClient()` rejects with the same shape so the
 *     hold-to-speak button can disable itself.
 */

import type { VoiceLocale } from './index';

let activeAudio: HTMLAudioElement | null = null;

export interface SpeakClientInput {
  text: string;
  lang: VoiceLocale;
  childId: string;
  /** 0..1 — applied to the HTMLAudioElement after the URL loads.
   *  Quiet-mode passes 0.6; default is 1.0. */
  volume?: number;
  /** Caller-supplied voice key. Defaults to charlotte. */
  voice?: 'charlotte' | 'sarah';
  /** Optional speed override (0.75 / 1.0 / 1.25 typical). */
  speed?: number;
}

export class VoiceServiceError extends Error {
  kind:
    | 'cap_reached'
    | 'voice_unavailable'
    | 'not_authorized'
    | 'invalid_input'
    | 'network'
    | 'playback'
    | 'mic_denied'
    | 'mic_unsupported'
    | 'unknown';
  status?: number;
  detail?: string;
  remainingUsd?: number;
  monthlyCapUsd?: number;
  constructor(kind: VoiceServiceError['kind'], message: string) {
    super(message);
    this.kind = kind;
    this.name = 'VoiceServiceError';
  }
}

/** What `speakClient` resolves with — gives the board client enough to
 *  surface the ⚡ Instant badge when the audio came from cache. */
export interface SpeakClientResult {
  /** True when the server reported the audio was a cache hit. */
  cached: boolean;
  /** End-to-end latency measured by the route handler, in milliseconds. */
  durationMs: number;
}

/**
 * Synthesize + play. Resolves when audio ends. Rejects with a typed
 * VoiceServiceError on any failure.
 *
 * Side effect: stores the active HTMLAudioElement in module state so
 * `cancelSpeechClient()` can stop it. A new call cancels the previous
 * one (matches the old browser-tts behavior).
 */
export async function speakClient(input: SpeakClientInput): Promise<SpeakClientResult> {
  cancelSpeechClient();

  const res = await fetch('/api/voice/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: input.text,
      language: input.lang,
      child_id: input.childId,
      voice_key: input.voice,
      speed: input.speed ?? 1.0,
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    let body: { error?: string; detail?: string; remainingUsd?: number; monthlyCapUsd?: number } =
      {};
    try {
      body = await res.json();
    } catch {
      /* body parse failed — keep default */
    }
    if (res.status === 429 && body.error === 'cap_reached') {
      const err = new VoiceServiceError('cap_reached', body.detail ?? 'cap_reached');
      err.status = 429;
      err.remainingUsd = body.remainingUsd;
      err.monthlyCapUsd = body.monthlyCapUsd;
      throw err;
    }
    if (res.status === 503 && body.error === 'voice_unavailable') {
      throw new VoiceServiceError('voice_unavailable', body.detail ?? 'voice_unavailable');
    }
    if (res.status === 403) {
      throw new VoiceServiceError('not_authorized', 'caller does not own child');
    }
    if (res.status === 400) {
      throw new VoiceServiceError('invalid_input', body.detail ?? 'invalid_input');
    }
    throw new VoiceServiceError('network', `synthesize ${res.status}: ${body.detail ?? '?'}`);
  }
  const body = (await res.json()) as {
    url?: string;
    cached?: boolean;
    durationMs?: number;
  };
  const url = body.url;
  if (!url) throw new VoiceServiceError('network', 'synthesize returned no url');
  const meta: SpeakClientResult = {
    cached: body.cached === true,
    durationMs: typeof body.durationMs === 'number' ? body.durationMs : 0,
  };

  // Play. Wait for ended. Reject on error.
  await new Promise<void>((resolve, reject) => {
    const audio = new Audio(url);
    audio.preload = 'auto';
    if (typeof input.volume === 'number') {
      audio.volume = Math.max(0, Math.min(1, input.volume));
    }
    activeAudio = audio;
    const cleanup = () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      if (activeAudio === audio) activeAudio = null;
    };
    const onEnded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new VoiceServiceError('playback', 'audio playback failed'));
    };
    audio.addEventListener('ended', onEnded, { once: true });
    audio.addEventListener('error', onError, { once: true });
    audio.play().catch((e: unknown) => {
      cleanup();
      reject(new VoiceServiceError('playback', e instanceof Error ? e.message : 'play() rejected'));
    });
  });
  return meta;
}

/** Stop any audio currently playing from a `speakClient()` call. */
export function cancelSpeechClient(): void {
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {
      /* noop */
    }
    activeAudio = null;
  }
}

// =============================================================================
// STT — transcribeClient()
// =============================================================================

export interface TranscribeClientInput {
  lang: VoiceLocale;
  childId: string;
  /** Hard cap on recording length in seconds. Phase 10.B raised this
   *  from 5 → 12 (longer = slower transcription, but children do
   *  occasionally need more than 5s). The client cuts off cleanly
   *  with a soft chime when the timer fires. */
  maxSec?: number;
  /** Fires when the MediaRecorder stops and we start uploading audio
   *  to /api/voice/transcribe. The parent uses this to flip the
   *  hold-to-speak button from "Listening…" → "Transcribing…". */
  onTranscribing?: () => void;
}

export interface TranscribeClientResult {
  /** Null when the server gracefully rejected the clip (too short,
   *  hallucination match, etc). The caller should surface `reason` /
   *  `detail` to the user instead of treating this as "the child said
   *  nothing". */
  transcript: string | null;
  language_detected?: string;
  duration_seconds?: number;
  /** Phase 9.B fields. */
  avg_logprob?: number;
  low_confidence?: boolean;
  hallucination_detected?: boolean;
  /** Set when the server rejected the clip with a typed reason. */
  reason?: 'too_short' | 'hallucination_detected' | 'low_confidence';
  /** Human-readable bilingual rejection copy (already localized). */
  detail?: string;
}

/**
 * Capture mic for up to `maxSec` seconds, send to /api/voice/transcribe,
 * return the transcript. Used by HoldToSpeakButton: caller calls this
 * once on hold-start; the helper returns when the user releases (the
 * hold-to-speak component manages release detection by ending the
 * stream early — but for v1 we cap by timer for simplicity).
 *
 * In v1 this is single-shot — record, transcribe, return. The
 * HoldToSpeakButton's release event simply ignores the result if it
 * arrives after the user moved on.
 */
export async function transcribeClient(
  input: TranscribeClientInput,
): Promise<TranscribeClientResult> {
  if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia) {
    throw new VoiceServiceError('mic_unsupported', 'MediaDevices API not available');
  }
  const maxMs = (input.maxSec ?? 12) * 1000;

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        // Browsers default to 48kHz — Whisper is happy at 16kHz too.
        // Don't specify sampleRate so Safari/Firefox negotiate freely.
      },
      video: false,
    });
  } catch (e) {
    throw new VoiceServiceError(
      'mic_denied',
      e instanceof Error ? e.message : 'getUserMedia denied',
    );
  }

  // Pick the best mime type the browser supports.
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  let mime = '';
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) {
      mime = c;
      break;
    }
  }

  const chunks: BlobPart[] = [];
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  rec.addEventListener('dataavailable', (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  });

  const stopped = new Promise<void>((resolve) => {
    rec.addEventListener('stop', () => resolve(), { once: true });
  });

  rec.start();
  const timer = window.setTimeout(() => {
    if (rec.state === 'recording') rec.stop();
  }, maxMs);

  await stopped;
  window.clearTimeout(timer);
  for (const t of stream.getTracks()) t.stop();

  if (chunks.length === 0) throw new VoiceServiceError('mic_denied', 'no audio captured');
  const audioBlob = new Blob(chunks, { type: mime || 'audio/webm' });

  // Recording finished — surface the "Transcribing…" state to the parent
  // so the user sees clear sequential feedback instead of one long
  // ambiguous spinner.
  input.onTranscribing?.();

  const fd = new FormData();
  fd.append('audio', audioBlob);
  fd.append('language', input.lang);
  fd.append('child_id', input.childId);

  const res = await fetch('/api/voice/transcribe', { method: 'POST', body: fd });
  if (!res.ok) {
    let body: { error?: string; detail?: string; remainingUsd?: number; monthlyCapUsd?: number } =
      {};
    try {
      body = await res.json();
    } catch {
      /* body parse failed */
    }
    if (res.status === 429 && body.error === 'cap_reached') {
      const err = new VoiceServiceError('cap_reached', body.detail ?? 'cap_reached');
      err.remainingUsd = body.remainingUsd;
      err.monthlyCapUsd = body.monthlyCapUsd;
      throw err;
    }
    if (res.status === 503) {
      throw new VoiceServiceError('voice_unavailable', body.detail ?? 'voice_unavailable');
    }
    if (res.status === 403) {
      throw new VoiceServiceError('not_authorized', 'caller does not own child');
    }
    if (res.status === 400) {
      throw new VoiceServiceError('invalid_input', body.detail ?? 'invalid_input');
    }
    throw new VoiceServiceError('network', `transcribe ${res.status}: ${body.detail ?? '?'}`);
  }
  const body = (await res.json()) as TranscribeClientResult;
  return body;
}

/**
 * Lightweight feature-detect for the hold-to-speak button. Returns the
 * UI-visible reason when STT cannot run (no MediaDevices, insecure
 * context, etc.). The actual `voice_unavailable` reason from the
 * server is surfaced AFTER a real call attempt — we don't want to
 * leak server-config state to the browser at idle.
 */
export function browserSupportsMic(): {
  available: boolean;
  reason?: 'no_mediadevices' | 'not_secure_context';
} {
  if (typeof window === 'undefined') return { available: false, reason: 'no_mediadevices' };
  if (!window.isSecureContext) return { available: false, reason: 'not_secure_context' };
  if (!('mediaDevices' in navigator) || !navigator.mediaDevices?.getUserMedia) {
    return { available: false, reason: 'no_mediadevices' };
  }
  return { available: true };
}
