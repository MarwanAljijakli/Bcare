'use client';

import { Loader2, Mic, MicOff, Play, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { transcribeClient, VoiceServiceError, browserSupportsMic } from '@/lib/voice/client';

/**
 * Voice quality acceptance gate (Quality Fix Phase 4).
 *
 * Six sample phrases (3 EN + 3 AR) — conversational rather than just
 * nouns — each rendered with a voice picker (charlotte/sarah), Play
 * button, cache-hit + latency + cost-per-call indicator.
 *
 * Plus a mic capture row that records 5 seconds, posts to
 * /api/voice/transcribe, and shows the transcript + detected language
 * + duration so the operator can confirm Whisper handles their voice.
 *
 * Live cost meter at the bottom totals the per-call costs the page has
 * incurred this session.
 */

interface SamplePhrase {
  id: string;
  locale: 'en' | 'ar';
  text: string;
}

const SAMPLES: SamplePhrase[] = [
  { id: 'en1', locale: 'en', text: 'I want to play with the blocks.' },
  { id: 'en2', locale: 'en', text: 'I am hungry. Can I have an apple?' },
  { id: 'en3', locale: 'en', text: "Let's go to the park after lunch." },
  { id: 'ar1', locale: 'ar', text: 'أبي، أحب أن أرسم معك.' },
  { id: 'ar2', locale: 'ar', text: 'أمي، أنا تعبان وأبي أن أنام.' },
  { id: 'ar3', locale: 'ar', text: 'هل نقدر نروح للحديقة بعد الغداء؟' },
];

type VoiceKey = 'charlotte' | 'sarah';

interface PlaybackResult {
  cached: boolean;
  durationMs: number;
  cost_usd: number;
  voice: VoiceKey;
}

export function VoiceTestClient({
  locale,
  childId,
}: {
  locale: 'en' | 'ar';
  childId: string | null;
}) {
  const [voice, setVoice] = useState<VoiceKey>('charlotte');
  const [active, setActive] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, PlaybackResult | { error: string }>>({});
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcribeMeta, setTranscribeMeta] = useState<{
    language_detected: string;
    duration_seconds: number;
    cost_usd: number;
  } | null>(null);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [totalCost, setTotalCost] = useState(0);
  const mic = browserSupportsMic();

  if (!childId) {
    return (
      <main className="container py-10">
        <h1 className="text-2xl font-bold">{locale === 'ar' ? 'اختبار الصوت' : 'Voice Test'}</h1>
        <p className="text-fg-muted mt-3 text-sm">
          {locale === 'ar'
            ? 'لا يوجد ملف طفل بعد. أكمل الإعداد أولًا.'
            : 'No child profile yet. Complete onboarding first.'}
        </p>
      </main>
    );
  }

  async function handlePlay(s: SamplePhrase) {
    setActive(s.id);
    setResults((r) => ({ ...r, [s.id]: { error: '…' } }));
    const startedAt = Date.now();
    try {
      // We can't read the cached/durationMs flags from speakClient (it
      // resolves on play-end, not on response). So we make a parallel
      // fetch to /api/voice/synthesize to get the metadata, then play.
      const metaRes = await fetch('/api/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: s.text,
          language: s.locale,
          child_id: childId,
          voice_key: voice,
          speed: 1.0,
        }),
      });
      if (!metaRes.ok) {
        const body = (await metaRes.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        const errMsg = body.error ?? `HTTP ${metaRes.status}`;
        setResults((r) => ({ ...r, [s.id]: { error: errMsg } }));
        setActive(null);
        return;
      }
      const meta = (await metaRes.json()) as {
        url: string;
        cached: boolean;
        durationMs: number;
        cost_usd: number;
        voice: VoiceKey;
      };
      // Now play it.
      const audio = new Audio(meta.url);
      await audio.play();
      audio.addEventListener('ended', () => setActive(null), { once: true });
      setResults((r) => ({
        ...r,
        [s.id]: {
          cached: meta.cached,
          durationMs: meta.durationMs,
          cost_usd: meta.cost_usd,
          voice: meta.voice,
        },
      }));
      setTotalCost((c) => c + meta.cost_usd);
      void startedAt;
    } catch (e) {
      setResults((r) => ({
        ...r,
        [s.id]: {
          error:
            e instanceof VoiceServiceError ? e.kind : e instanceof Error ? e.message : 'unknown',
        },
      }));
      setActive(null);
    }
  }

  async function handleMic() {
    setRecording(true);
    setTranscript(null);
    setTranscribeMeta(null);
    setTranscribeError(null);
    try {
      const res = await transcribeClient({ lang: locale, childId: childId!, maxSec: 5 });
      setTranscript(res.transcript);
      setTranscribeMeta({
        language_detected: res.language_detected,
        duration_seconds: res.duration_seconds,
        cost_usd: 0, // /api/voice/transcribe returns cost_usd; we don't expose it via transcribeClient yet.
      });
    } catch (e) {
      const kind = e instanceof VoiceServiceError ? e.kind : 'unknown';
      setTranscribeError(kind);
    } finally {
      setRecording(false);
    }
  }

  const enSamples = SAMPLES.filter((s) => s.locale === 'en');
  const arSamples = SAMPLES.filter((s) => s.locale === 'ar');
  return (
    <main className="container space-y-8 py-10">
      <header className="space-y-2">
        <h1 className="text-fg text-3xl font-bold">
          {locale === 'ar' ? 'اختبار جودة الصوت' : 'Voice quality test'}
        </h1>
        <p className="text-fg-muted text-sm">
          {locale === 'ar'
            ? 'استمع إلى العبارات النموذجية وتحقق من النطق. اضغط Mic لاختبار التعرّف على الصوت.'
            : 'Listen to the sample phrases and confirm intelligibility. Press Mic to test transcription.'}
        </p>
      </header>

      {/* Voice picker */}
      <section className="border-border bg-bg-elevated flex items-center gap-3 rounded-2xl border p-4">
        <span className="text-fg-subtle text-xs font-semibold uppercase tracking-wide">
          {locale === 'ar' ? 'الصوت' : 'Voice'}
        </span>
        {(['charlotte', 'sarah'] as const).map((k) => (
          <Button
            key={k}
            type="button"
            size="sm"
            variant={voice === k ? 'primary' : 'secondary'}
            onClick={() => setVoice(k)}
          >
            {k}
          </Button>
        ))}
      </section>

      {/* EN samples */}
      <SampleSection
        title="English samples"
        samples={enSamples}
        active={active}
        results={results}
        onPlay={handlePlay}
      />

      {/* AR samples */}
      <SampleSection
        title={locale === 'ar' ? 'العبارات العربية' : 'Arabic samples'}
        samples={arSamples}
        active={active}
        results={results}
        onPlay={handlePlay}
        rtl
      />

      {/* Mic test */}
      <section className="border-border bg-bg-elevated space-y-3 rounded-2xl border p-5">
        <h2 className="text-fg text-lg font-bold">
          {locale === 'ar' ? 'اختبار الميكروفون' : 'Mic test'}
        </h2>
        <p className="text-fg-muted text-xs">
          {locale === 'ar'
            ? 'اضغط الزر وتحدّث لمدة ٥ ثوانٍ. سنرسل التسجيل إلى Whisper ونعرض النص.'
            : 'Press the button and speak for 5 seconds. We send the recording to Whisper and show the transcript.'}
        </p>
        <Button type="button" disabled={!mic.available || recording} onClick={handleMic}>
          {recording ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : mic.available ? (
            <Mic aria-hidden="true" className="h-4 w-4" />
          ) : (
            <MicOff aria-hidden="true" className="h-4 w-4" />
          )}
          <span className="ms-2">
            {recording
              ? locale === 'ar'
                ? 'يسجّل…'
                : 'Recording…'
              : mic.available
                ? locale === 'ar'
                  ? 'سجّل ٥ ثوانٍ'
                  : 'Record 5 seconds'
                : locale === 'ar'
                  ? 'الميكروفون غير متاح'
                  : 'Mic unavailable'}
          </span>
        </Button>
        {transcript !== null && (
          <div className="bg-bg/40 border-border-muted rounded-xl border p-3">
            <p className="text-fg-subtle text-xs uppercase tracking-wide">
              {locale === 'ar' ? 'النص' : 'Transcript'}
            </p>
            <p className="text-fg mt-1 text-base font-semibold" dir="auto">
              {transcript || (locale === 'ar' ? '(لا شيء)' : '(empty)')}
            </p>
            {transcribeMeta && (
              <p className="text-fg-muted mt-2 text-xs">
                lang_detected = {transcribeMeta.language_detected} · duration ={' '}
                {transcribeMeta.duration_seconds.toFixed(2)}s
              </p>
            )}
          </div>
        )}
        {transcribeError !== null && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {locale === 'ar' ? 'تعذّر النسخ:' : 'Transcribe failed:'} {transcribeError}
          </p>
        )}
      </section>

      {/* Cost meter */}
      <section className="border-border-muted bg-bg-muted/40 rounded-xl border border-dashed p-4 text-xs">
        <p className="text-fg-subtle uppercase tracking-wide">
          {locale === 'ar' ? 'تكلفة هذه الجلسة' : 'Session cost'}
        </p>
        <p className="text-fg mt-1 text-lg font-bold tabular-nums">${totalCost.toFixed(4)}</p>
      </section>
    </main>
  );
}

function SampleSection({
  title,
  samples,
  active,
  results,
  onPlay,
  rtl,
}: {
  title: string;
  samples: SamplePhrase[];
  active: string | null;
  results: Record<string, PlaybackResult | { error: string }>;
  onPlay: (s: SamplePhrase) => void;
  rtl?: boolean;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-fg text-lg font-bold">{title}</h2>
      <ul className="space-y-2">
        {samples.map((s) => {
          const r = results[s.id];
          return (
            <li
              key={s.id}
              className="border-border bg-bg-elevated flex items-center gap-3 rounded-2xl border p-4"
            >
              <Button type="button" size="sm" disabled={active !== null} onClick={() => onPlay(s)}>
                {active === s.id ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <Play aria-hidden="true" className="h-4 w-4" />
                )}
                <Volume2 aria-hidden="true" className="ms-1 h-4 w-4" />
              </Button>
              <p className="text-fg flex-1 text-sm font-semibold" dir={rtl ? 'rtl' : 'ltr'}>
                {s.text}
              </p>
              {r && 'error' in r ? (
                <span className="text-xs text-amber-700 dark:text-amber-300">{r.error}</span>
              ) : r ? (
                <span className="text-fg-muted text-xs tabular-nums">
                  {r.cached ? 'cached' : 'fresh'} · {r.durationMs}ms · ${r.cost_usd.toFixed(4)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
