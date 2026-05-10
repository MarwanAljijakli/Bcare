'use client';

import { Loader2, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BoardSymbol, CategoryKey } from '@/components/board/types';
import { CategoryRail } from '@/components/board/category-rail';
import { FavoritesBar } from '@/components/board/favorites-bar';
import { HoldToSpeakButton } from '@/components/board/hold-to-speak-button';
import { QuietModeToggle } from '@/components/board/quiet-mode-toggle';
import { SentenceStrip } from '@/components/board/sentence-strip';
import { SpeakButton } from '@/components/board/speak-button';
import { SymbolGrid } from '@/components/board/symbol-grid';
import { symbolLabel } from '@/components/board/types';
import { StarCelebration } from '@/components/gamification/star-celebration';
import { trpc } from '@/lib/trpc/client';
import {
  getSttAvailability,
  matchTranscriptToSymbol,
  recognizeOnce,
} from '@/lib/voice/browser-stt';
import { speak as ttsSpeak, cancel as ttsCancel } from '@/lib/voice/browser-tts';

/**
 * Board client. Holds:
 *   • bootstrap query (one round-trip on mount).
 *   • session state (open on first interaction, autosave every 10s,
 *     close on unmount / unload).
 *   • sentence-strip token list.
 *   • TTS + STT integration via browser APIs.
 *   • quiet mode toggle (boolean state, not persisted yet — Module 6
 *     will persist into the child's sensory_profile).
 *
 * Privacy posture in this file:
 *   • Transcript text from STT is matched against the symbol catalogue
 *     in-memory and discarded. The DB never sees the literal string.
 *   • input_events records modality + symbol_id + latency_ms only.
 *   • No analytics SDK is loaded on this surface.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const PUBLIC_BUCKET_PATH = (bucket: string, key: string) =>
  `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${key}`;

const AUTOSAVE_INTERVAL_MS = 10_000;

export function BoardClient({ locale }: { locale: 'en' | 'ar' }) {
  const t = useTranslations('marketing.app.board');
  const bootstrap = trpc.board.bootstrap.useQuery();
  const openSession = trpc.board.openSession.useMutation();
  const recordInput = trpc.board.recordInput.useMutation();
  const recordOutput = trpc.board.recordOutput.useMutation();
  const closeSession = trpc.board.closeSession.useMutation();

  const [tokens, setTokens] = useState<BoardSymbol[]>([]);
  const [category, setCategory] = useState<CategoryKey>('all');
  const [quietMode, setQuietMode] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [listening, setListening] = useState(false);
  const [sttUnavailableReason, setSttUnavailableReason] = useState<string | null>(null);
  const [celebrationKey, setCelebrationKey] = useState(0);

  // Module 5 — gamification. Awards a star on TTS success (server-side
  // enforces the 5/day cap + streak math). The component below renders
  // the soft 200ms celebration; both reduced-motion and quiet-mode skip
  // the animation but the star still counts.
  const awardStar = trpc.gamification.awardOnSpeak.useMutation();

  const sessionIdRef = useRef<string | null>(null);
  const sessionStartRef = useRef<number>(0);
  const inputCountRef = useRef(0);
  const outputCountRef = useRef(0);
  const successfulCountRef = useRef(0);
  const lastTapAtRef = useRef<number>(0);

  const stt = useMemo(() => getSttAvailability(), []);
  useEffect(() => {
    if (!stt.available) {
      setSttUnavailableReason(stt.reason);
    }
  }, [stt]);

  const data = bootstrap.data;
  const child = data?.child;
  const symbols = data?.symbols ?? [];
  const favorites = data?.favorites ?? [];
  const bucket = data?.bucket ?? 'symbols-public';

  const imageUrl = useCallback((path: string) => PUBLIC_BUCKET_PATH(bucket, path), [bucket]);

  // Open a session on first interaction. Defer until the user actually
  // taps something so we don't write empty rows for caregivers who
  // navigate to /board to peek.
  const ensureSession = useCallback(async () => {
    if (sessionIdRef.current || !child) return;
    try {
      const res = await openSession.mutateAsync({ childId: child.id });
      sessionIdRef.current = res.sessionId;
      sessionStartRef.current = Date.now();
    } catch {
      // Best-effort. The board still works locally; events just don't
      // persist this session.
    }
  }, [child, openSession]);

  // Autosave: every 10s while a session is open, push aggregate counters.
  useEffect(() => {
    if (!sessionIdRef.current) return;
    const id = window.setInterval(() => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      const durationSec = Math.max(0, Math.floor((Date.now() - sessionStartRef.current) / 1000));
      // closeSession with running-totals is idempotent on the server.
      void closeSession.mutateAsync({
        sessionId: sid,
        durationSeconds: durationSec,
        inputCount: inputCountRef.current,
        outputCount: outputCountRef.current,
        successfulSelections: successfulCountRef.current,
      });
    }, AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [closeSession]);

  // Final close on unmount / page hide.
  useEffect(() => {
    const onHide = () => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      const durationSec = Math.max(0, Math.floor((Date.now() - sessionStartRef.current) / 1000));
      navigator.sendBeacon?.(
        '/api/trpc/board.closeSession?batch=0',
        // sendBeacon path is best-effort; the autosave above is the
        // primary write path.
        new Blob(
          [
            JSON.stringify({
              0: {
                json: {
                  sessionId: sid,
                  durationSeconds: durationSec,
                  inputCount: inputCountRef.current,
                  outputCount: outputCountRef.current,
                  successfulSelections: successfulCountRef.current,
                },
              },
            }),
          ],
          { type: 'application/json' },
        ),
      );
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, []);

  function handleSelect(symbol: BoardSymbol) {
    const now = performance.now();
    const latency = lastTapAtRef.current ? Math.round(now - lastTapAtRef.current) : undefined;
    lastTapAtRef.current = now;
    setTokens((prev) => [...prev, symbol]);
    inputCountRef.current += 1;
    successfulCountRef.current += 1;
    void ensureSession().then(() => {
      const sid = sessionIdRef.current;
      if (!sid || !child) return;
      void recordInput.mutateAsync({
        sessionId: sid,
        childId: child.id,
        modality: 'symbol',
        symbolId: symbol.id,
        latencyMs: latency,
      });
    });
  }

  async function handleSpeak() {
    if (tokens.length === 0 || !child) return;
    const text = tokens.map((s) => symbolLabel(s, locale)).join(' ');
    setSpeaking(true);
    setHighlightIndex(0);
    // Drive a soft per-token highlight; the TTS doesn't expose word
    // boundaries reliably across browsers, so we time-slice naively.
    const tickMs = Math.max(280, Math.min(700, 4500 / tokens.length));
    const tick = window.setInterval(() => {
      setHighlightIndex((i) => (i === null ? 0 : Math.min(i + 1, tokens.length - 1)));
    }, tickMs);
    const startedAt = Date.now();
    try {
      await ttsSpeak({
        text,
        lang: locale,
        volume: quietMode ? 0.6 : 1,
      });
      outputCountRef.current += 1;
      // Award a star — server enforces the daily cap (5) and streak math.
      // Best-effort: a network blip shouldn't degrade the speak experience.
      try {
        const award = await awardStar.mutateAsync({ childId: child.id });
        if (award.awarded) setCelebrationKey((k) => k + 1);
      } catch {
        /* swallow — gamification is purely additive to the board flow */
      }
      const sid = sessionIdRef.current;
      if (sid) {
        void recordOutput.mutateAsync({
          sessionId: sid,
          childId: child.id,
          modality: 'tts',
          durationMs: Date.now() - startedAt,
          payload: { symbolIds: tokens.map((tk) => tk.id), voiceId: child.voice_id ?? undefined },
        });
      }
    } finally {
      window.clearInterval(tick);
      setSpeaking(false);
      setHighlightIndex(null);
    }
  }

  async function handleHoldStart() {
    if (!stt.available || !child) return;
    setListening(true);
    try {
      const result = await recognizeOnce({ lang: locale, timeoutSec: 6 });
      const matchPool = symbols.map((s) => ({
        id: s.id,
        label: locale === 'ar' ? s.label_ar : s.label_en,
        phonetic: locale === 'ar' ? s.phonetic_ar : s.phonetic_en,
      }));
      const match = matchTranscriptToSymbol(result.transcript, matchPool);
      // result.transcript is dropped at the end of this scope — never persisted.
      if (match) {
        const symbol = symbols.find((s) => s.id === match.symbolId);
        if (symbol) {
          setTokens((prev) => [...prev, symbol]);
          inputCountRef.current += 1;
          successfulCountRef.current += 1;
          await ensureSession();
          const sid = sessionIdRef.current;
          if (sid) {
            void recordInput.mutateAsync({
              sessionId: sid,
              childId: child.id,
              modality: 'speech',
              symbolId: symbol.id,
              payload: { confidence: result.confidence },
            });
          }
        }
      }
    } catch {
      // Permission denied / no_match / timeout — surface silently in v1;
      // a future iteration will show a friendly toast.
    } finally {
      setListening(false);
    }
  }

  function handleHoldStop() {
    // Recognition stops itself when the user releases the hold button —
    // recognizeOnce is single-shot. Nothing to do here in v1.
  }

  function handleRemove(index: number) {
    setTokens((prev) => prev.filter((_, i) => i !== index));
  }

  function handleClear() {
    ttsCancel();
    setTokens([]);
    setSpeaking(false);
    setHighlightIndex(null);
  }

  if (bootstrap.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 aria-hidden="true" className="text-primary h-8 w-8 animate-spin" />
        <span className="sr-only">{t('loading')}</span>
      </div>
    );
  }

  if (bootstrap.isError || !child) {
    return (
      <div className="container flex min-h-dvh items-center justify-center">
        <div className="border-border bg-bg-elevated max-w-md rounded-2xl border p-8 text-center">
          <AlertCircle aria-hidden="true" className="text-warning mx-auto h-10 w-10" />
          <h1 className="text-fg mt-4 text-xl font-bold">{t('error.title')}</h1>
          <p className="text-fg-muted mt-2 text-sm">{t('error.body')}</p>
        </div>
      </div>
    );
  }

  const tileSize = child.sensory_profile.touch;

  const categoryLabels: Record<CategoryKey, string> = {
    all: t('categories.all'),
    core: t('categories.core'),
    food: t('categories.food'),
    feelings: t('categories.feelings'),
    people: t('categories.people'),
    actions: t('categories.actions'),
    places: t('categories.places'),
    time: t('categories.time'),
  };

  return (
    <div className="bg-bg flex min-h-dvh flex-col">
      {/* Soft milestone celebration. Skips render entirely when reduced-motion
       *  is set or quiet mode is on. */}
      <StarCelebration triggerKey={celebrationKey} silent={quietMode} caption={t('starEarned')} />
      <header className="border-border bg-bg/90 sticky top-0 z-20 flex items-center gap-3 border-b px-4 py-3 backdrop-blur md:px-6">
        <h1 className="text-fg flex-1 text-lg font-bold tracking-tight md:text-xl">
          {t('greeting', { name: child.preferred_name || child.full_name })}
        </h1>
        <HoldToSpeakButton
          onStart={() => void handleHoldStart()}
          onStop={handleHoldStop}
          available={stt.available}
          listening={listening}
          label={t('holdToSpeak')}
          unavailableLabel={t('holdToSpeakUnavailable')}
        />
        <QuietModeToggle
          on={quietMode}
          onChange={setQuietMode}
          labelOn={t('quietModeOn')}
          labelOff={t('quietModeOff')}
        />
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <SentenceStrip
          tokens={tokens}
          locale={locale}
          imageUrl={imageUrl}
          onRemove={handleRemove}
          onClear={handleClear}
          speaking={speaking}
          highlightIndex={highlightIndex}
          strings={{
            remove: t('sentence.remove'),
            clear: t('sentence.clear'),
            placeholder: t('sentence.placeholder'),
          }}
        />

        {favorites.length > 0 && (
          <FavoritesBar
            favoriteIds={favorites}
            symbols={symbols}
            locale={locale}
            imageUrl={imageUrl}
            size={tileSize}
            showPhonetic={false}
            onSelect={handleSelect}
            label={t('favorites')}
          />
        )}

        <div className="flex flex-1 gap-4">
          <CategoryRail active={category} onChange={setCategory} labels={categoryLabels} />
          <main className="flex-1">
            <SymbolGrid
              symbols={symbols}
              locale={locale}
              imageUrl={imageUrl}
              category={category}
              size={tileSize}
              showPhonetic={true}
              onSelect={handleSelect}
            />
          </main>
        </div>
      </div>

      <SpeakButton
        speaking={speaking}
        disabled={tokens.length === 0}
        quietMode={quietMode}
        onClick={() => void handleSpeak()}
        label={t('speak')}
        speakingLabel={t('speaking')}
        emptyLabel={t('emptySpeak')}
      />

      <footer className="text-fg-subtle border-border container border-t py-3 text-center text-xs">
        {t('attribution')}
      </footer>

      {sttUnavailableReason && (
        <p role="status" className="sr-only">
          {t(`sttReasons.${sttUnavailableReason}` as 'sttReasons.no_browser_api')}
        </p>
      )}
    </div>
  );
}
