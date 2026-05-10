/**
 * Mock voice provider. Returns a deterministic data-URL of a short brand
 * tone so the voice-preview step in onboarding works end-to-end without
 * ElevenLabs / Azure keys.
 *
 * The data-URL is a 0.4-second sine sweep encoded as a tiny WAV. Any
 * audio element can play it. The "cacheHit" flag is always `true` so
 * mock previews never charge the cost-guard ledger.
 */

import type { SpeakInput, SpeakResult } from './index';

// Pre-generated 22 050 Hz, 16-bit mono, 0.4 s sine sweep 440→660 Hz.
// 8820 samples → 17 644-byte WAV (44-byte header + samples × 2). Encoded
// as base64 so we can ship it inline. We keep the byte length small by
// using a low sample rate; quality is fine for "yes I heard a tone."
const MOCK_WAV_DATA_URL =
  'data:audio/wav;base64,UklGRsRDAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQBDAAAA';

// Build the actual sweep at runtime so the real bytes match the header.
function buildBrandTone(): string {
  const sampleRate = 22050;
  const durationSec = 0.4;
  const samples = Math.floor(sampleRate * durationSec);
  const headerSize = 44;
  const dataSize = samples * 2;
  const totalSize = headerSize + dataSize;

  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  // RIFF header
  writeStr(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeStr(view, 8, 'WAVE');
  // fmt subchunk
  writeStr(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // subchunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  // data subchunk
  writeStr(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  // sweep 440 → 660 Hz
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const f = 440 + (660 - 440) * (i / samples);
    const sample = Math.sin(2 * Math.PI * f * t) * 0.25;
    const env = Math.min(1, i / 200, (samples - i) / 200);
    const v = Math.round(sample * env * 32767);
    view.setInt16(headerSize + i * 2, v, true);
  }
  // base64 encode
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  // btoa exists in both browser and Edge runtime; for Node we fall back.
  const b64 =
    typeof globalThis.btoa === 'function'
      ? globalThis.btoa(binary)
      : Buffer.from(binary, 'binary').toString('base64');
  return `data:audio/wav;base64,${b64}`;
}

function writeStr(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

let cached: string | null = null;

export async function mockSpeak(_input: SpeakInput): Promise<SpeakResult> {
  if (!cached) cached = buildBrandTone();
  // Suppress unused-warning on the placeholder constant — kept so future
  // codepaths can switch providers without renaming.
  void MOCK_WAV_DATA_URL;
  return {
    audioUrl: cached,
    provider: 'mock',
    cacheHit: true,
  };
}
