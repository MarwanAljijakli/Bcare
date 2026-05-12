import 'server-only';

/**
 * HTTP keep-alive for voice provider clients (Phase 10.A.4).
 *
 * Node 18+ ships an internal undici-backed `fetch()` whose default
 * dispatcher already uses HTTP/1.1 keep-alive: connections to the same
 * origin are pooled by default with a 5s idle timeout. The
 * ElevenLabs + OpenAI hosts therefore reuse the same TCP+TLS session
 * across consecutive calls on the same Vercel function instance,
 * saving the 100–300 ms TLS handshake on warm requests.
 *
 * We previously tried importing `undici` directly to bump the
 * keepAliveTimeout to 60 s, but that adds a top-level dependency
 * Phase 10's binding constraint forbids. The default 5 s pool is
 * enough for the bursty TTS / STT traffic we see on the board:
 *
 *   - Tap a symbol → speak()                 (first warm call)
 *   - Tap another symbol within 5s → speak() (reuses connection)
 *
 * If we ever need a longer idle timeout, the right move is to use
 * `import('undici')` lazily and `setGlobalDispatcher` — but only after
 * adding `undici` to package.json explicitly.
 *
 * This module is imported for its side-effect at the top of every
 * voice client (`./openai-tts.ts`, `./elevenlabs.ts`, `./whisper.ts`,
 * `./index.ts`) as a single hookable point. Today it's a no-op; the
 * comment is the contract.
 */
export function ensureKeepAliveDispatcher(): void {
  // Intentional no-op — see file-level docstring.
}

ensureKeepAliveDispatcher();
