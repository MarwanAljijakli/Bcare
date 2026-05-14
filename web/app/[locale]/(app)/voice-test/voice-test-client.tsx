'use client';

import { Loader2, Mic, MicOff, Play, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { transcribeClient, VoiceServiceError, browserSupportsMic } from '@/lib/voice/client';

/**
 * Voice quality acceptance gate — Quality Fix Phase 4 + 8.C.
 *
 * Six sample phrases (3 EN + 3 AR). For each, TWO Play buttons
 * side-by-side: "ElevenLabs" and "OpenAI". The user listens to BOTH
 * Arabic versions and picks the more intelligible one. The winner
 * becomes the production default (set via VOICE_PROVIDER_PRIMARY env
 * or per-child voice setting).
 *
 * Mic capture row records 5 seconds, posts to /api/voice/transcribe,
 * shows transcript + detected language + duration.
 *
 * Live cost meter at the bottom totals the per-call costs across both
 * providers this session.
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

type Provider = 'elevenlabs' | 'openai';

interface PlaybackResult {
  cached: boolean;
  durationMs: number;
  cost_usd: number;
  provider: Provider;
  fallback_trigger: string | null;
}

type ResultKey = `${string}|${Provider}`;

export function VoiceTestClient({
  locale,
  childId,
}: {
  locale: 'en' | 'ar';
  childId: string | null;
}) {
  const [active, setActive] = useState<ResultKey | null>(null);
  const [results, setResults] = useState<Record<ResultKey, PlaybackResult | { error: string }>>({});
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcribeMeta, setTranscribeMeta] = useState<{
    language_detected?: string;
    duration_seconds?: number;
    avg_logprob?: number;
    low_confidence?: boolean;
    hallucination_detected?: boolean;
    reason?: 'too_short' | 'hallucination_detected' | 'low_confidence';
    detail?: string;
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

  async function handlePlay(s: SamplePhrase, provider: Provider) {
    const key: ResultKey = `${s.id}|${provider}`;
    setActive(key);
    setResults((r) => ({ ...r, [key]: { error: '…' } }));
    try {
      const metaRes = await fetch('/api/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: s.text,
          language: s.locale,
          child_id: childId,
          voice_key: 'charlotte',
          speed: 1.0,
          provider, // PIN — no fallback chain on the A/B comparison.
        }),
      });
      if (!metaRes.ok) {
        const body = (await metaRes.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        const errMsg = body.detail
          ? `${body.error ?? 'error'}: ${body.detail.slice(0, 80)}`
          : (body.error ?? `HTTP ${metaRes.status}`);
        setResults((r) => ({ ...r, [key]: { error: errMsg } }));
        setActive(null);
        return;
      }
      const meta = (await metaRes.json()) as {
        url: string;
        cached: boolean;
        durationMs: number;
        cost_usd: number;
        provider: Provider;
        fallback_trigger: string | null;
      };
      const audio = new Audio(meta.url);
      await audio.play();
      audio.addEventListener('ended', () => setActive(null), { once: true });
      setResults((r) => ({
        ...r,
        [key]: {
          cached: meta.cached,
          durationMs: meta.durationMs,
          cost_usd: meta.cost_usd,
          provider: meta.provider,
          fallback_trigger: meta.fallback_trigger ?? null,
        },
      }));
      setTotalCost((c) => c + meta.cost_usd);
    } catch (e) {
      setResults((r) => ({
        ...r,
        [key]: {
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
      const res = await transcribeClient({ lang: locale, childId: childId!, maxSec: 8 });
      setTranscript(res.transcript ?? '');
      setTranscribeMeta({
        language_detected: res.language_detected,
        duration_seconds: res.duration_seconds,
        avg_logprob: res.avg_logprob,
        low_confidence: res.low_confidence,
        hallucination_detected: res.hallucination_detected,
        reason: res.reason,
        detail: res.detail,
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
          {locale === 'ar' ? 'اختبار جودة الصوت — مقارنة بين المزوّدين' : 'Voice A/B comparison'}
        </h1>
        <p className="text-fg-muted text-sm">
          {locale === 'ar'
            ? 'لكل عبارة، اضغط ElevenLabs ثم OpenAI واستمع للاثنين. اختر المزوّد الذي يبدو أوضح وأكثر طبيعية كلام طفل سعودي. هذا الاختيار يصبح المزوّد الافتراضي للإنتاج.'
            : 'For each phrase, press ElevenLabs then OpenAI and listen to both. Pick the provider that sounds clearer and more natural for a Saudi child. Your choice becomes the production default.'}
        </p>
      </header>

      <SampleSection
        title={locale === 'ar' ? 'العبارات الإنجليزية' : 'English samples'}
        samples={enSamples}
        active={active}
        results={results}
        onPlay={handlePlay}
      />

      <SampleSection
        title={
          locale === 'ar' ? 'العبارات العربية (اختبار القبول)' : 'Arabic samples (acceptance gate)'
        }
        samples={arSamples}
        active={active}
        results={results}
        onPlay={handlePlay}
        rtl
      />

      <section className="border-border bg-bg-elevated space-y-3 rounded-2xl border p-5">
        <h2 className="text-fg text-lg font-bold">
          {locale === 'ar' ? 'اختبار الميكروفون' : 'Mic test (Whisper)'}
        </h2>
        <p className="text-fg-muted text-xs">
          {locale === 'ar'
            ? 'اضغط الزر وتحدّث لمدة ٨ ثوانٍ. سنرسل التسجيل إلى Whisper ونعرض النص.'
            : 'Press the button and speak for 8 seconds. We send the recording to Whisper and show the transcript.'}
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
                  ? 'سجّل ٨ ثوانٍ'
                  : 'Record 8 seconds'
                : locale === 'ar'
                  ? 'الميكروفون غير متاح'
                  : 'Mic unavailable'}
          </span>
        </Button>
        {transcribeMeta?.reason === 'too_short' && (
          <div className="rounded-xl border border-amber-300/40 bg-amber-50/40 p-3 dark:border-amber-700/40 dark:bg-amber-950/30">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
              {locale === 'ar' ? 'التسجيل قصير جدًا' : 'Recording too short'}
            </p>
            <p className="text-fg-muted mt-1 text-xs">{transcribeMeta.detail}</p>
          </div>
        )}
        {transcribeMeta?.reason === 'hallucination_detected' && (
          <div className="rounded-xl border border-amber-300/40 bg-amber-50/40 p-3 dark:border-amber-700/40 dark:bg-amber-950/30">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
              {locale === 'ar' ? 'تعذّر التعرّف على الصوت' : 'Could not recognize audio'}
            </p>
            <p className="text-fg-muted mt-1 text-xs">{transcribeMeta.detail}</p>
          </div>
        )}
        {transcript !== null &&
          transcribeMeta?.reason !== 'too_short' &&
          transcribeMeta?.reason !== 'hallucination_detected' && (
            <div className="bg-bg/40 border-border-muted rounded-xl border p-3">
              <p className="text-fg-subtle text-xs uppercase tracking-wide">
                {locale === 'ar' ? 'النص' : 'Transcript'}
              </p>
              <p className="text-fg mt-1 text-base font-semibold" dir="auto">
                {transcript || (locale === 'ar' ? '(لا شيء)' : '(empty)')}
              </p>
              {transcribeMeta && (
                <p className="text-fg-muted mt-2 text-xs">
                  {transcribeMeta.language_detected !== undefined && (
                    <>lang_detected = {transcribeMeta.language_detected} · </>
                  )}
                  {transcribeMeta.duration_seconds !== undefined && (
                    <>duration = {transcribeMeta.duration_seconds.toFixed(2)}s</>
                  )}
                  {transcribeMeta.avg_logprob !== undefined &&
                    Number.isFinite(transcribeMeta.avg_logprob) && (
                      <> · avg_logprob = {transcribeMeta.avg_logprob.toFixed(2)}</>
                    )}
                </p>
              )}
              {transcribeMeta?.reason === 'low_confidence' && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  {transcribeMeta.detail}
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

      <section className="border-border-muted bg-bg-muted/40 rounded-xl border border-dashed p-4 text-xs">
        <p className="text-fg-subtle uppercase tracking-wide">
          {locale === 'ar' ? 'تكلفة هذه الجلسة' : 'Session cost (both providers)'}
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
  active: ResultKey | null;
  results: Record<ResultKey, PlaybackResult | { error: string }>;
  onPlay: (s: SamplePhrase, provider: Provider) => void;
  rtl?: boolean;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-fg text-lg font-bold">{title}</h2>
      <ul className="space-y-3">
        {samples.map((s) => (
          <li key={s.id} className="border-border bg-bg-elevated space-y-3 rounded-2xl border p-4">
            <p className="text-fg text-base font-semibold leading-snug" dir={rtl ? 'rtl' : 'ltr'}>
              {s.text}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <ProviderRow
                provider="elevenlabs"
                label="ElevenLabs (Multilingual v2)"
                sample={s}
                active={active}
                result={results[`${s.id}|elevenlabs`]}
                onPlay={onPlay}
              />
              <ProviderRow
                provider="openai"
                label="OpenAI (tts-1-hd)"
                sample={s}
                active={active}
                result={results[`${s.id}|openai`]}
                onPlay={onPlay}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProviderRow({
  provider,
  label,
  sample,
  active,
  result,
  onPlay,
}: {
  provider: Provider;
  label: string;
  sample: SamplePhrase;
  active: ResultKey | null;
  result: PlaybackResult | { error: string } | undefined;
  onPlay: (s: SamplePhrase, provider: Provider) => void;
}) {
  const key: ResultKey = `${sample.id}|${provider}`;
  const isActive = active === key;
  return (
    <div className="border-border-muted bg-bg/40 flex items-center gap-2 rounded-xl border p-3">
      <Button
        type="button"
        size="sm"
        variant={result && !('error' in result) ? 'secondary' : 'primary'}
        disabled={active !== null}
        onClick={() => onPlay(sample, provider)}
      >
        {isActive ? (
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        ) : (
          <Play aria-hidden="true" className="h-4 w-4" />
        )}
        <Volume2 aria-hidden="true" className="ms-1 h-4 w-4" />
        <span className="ms-2 text-xs font-semibold">{label}</span>
      </Button>
      <div className="min-w-0 flex-1 text-end text-xs leading-tight">
        {result && 'error' in result ? (
          <span className="text-amber-700 dark:text-amber-300">{result.error}</span>
        ) : result ? (
          <span className="text-fg-muted tabular-nums">
            {result.cached ? 'cached' : 'fresh'} · {result.durationMs}ms · $
            {result.cost_usd.toFixed(4)}
          </span>
        ) : (
          <span className="text-fg-subtle">—</span>
        )}
      </div>
    </div>
  );
}
