'use client';

import { Loader2, Pause, Play } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useStepError } from '../use-step-error';
import { WizardActions } from '../wizard-actions';
import type { AppLocale } from '@/i18n/routing';
import { useRouter } from '@/i18n/routing';
import { trpc } from '@/lib/trpc/client';

/**
 * Voice picker — Phase 11.B Bug 2 fix.
 *
 * The previous implementation hard-coded abstract voice IDs
 * ('voice-warm' / 'voice-clear' / 'voice-soft') that didn't map to any
 * voice the TTS pipeline actually supports, and called `/api/voice-
 * preview` which requires a child_id (we don't have one yet at this
 * step). Result: every preview button silently failed.
 *
 * The pipeline supports two voices that work across both locales:
 *   - charlotte → ElevenLabs Charlotte (AR primary) / OpenAI Nova (EN)
 *   - sarah     → ElevenLabs Sarah (AR alt) / OpenAI Shimmer (EN)
 *
 * Previews call /api/voice-sample which is cache-keyed by
 * (locale, voice) — first click synthesizes once and stores in
 * tts-cache; subsequent clicks redirect to the CDN-cached MP3.
 */
const VOICES = [{ id: 'charlotte' as const }, { id: 'sarah' as const }];

const MAX_PREVIEWS = 6;

export function VoiceStep({ initial }: { initial: string | undefined }) {
  const t = useTranslations('marketing.auth.onboardingWizard.voice');
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  // Tolerate legacy voiceIds from older drafts (`voice-warm` etc.) by
  // mapping them onto the new canonical set; default to charlotte.
  const normalized: 'charlotte' | 'sarah' =
    initial === 'sarah' || initial === 'shimmer' || initial === 'voice-soft'
      ? 'sarah'
      : 'charlotte';
  const [voiceId, setVoiceId] = useState<'charlotte' | 'sarah'>(normalized);
  const [previews, setPreviews] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { errorMessage, captureError, clearError } = useStepError();
  const upsert = trpc.onboarding.upsertDraft.useMutation();

  // Stop any in-flight preview when the component unmounts so audio
  // doesn't keep playing after the user navigates away.
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio) {
        audio.pause();
        audio.src = '';
      }
    };
  }, []);

  async function togglePreview(id: 'charlotte' | 'sarah') {
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;

    // Second click on the currently-playing button = stop.
    if (playingId === id) {
      audio.pause();
      audio.currentTime = 0;
      setPlayingId(null);
      return;
    }

    if (previews >= MAX_PREVIEWS) return;

    // Different button while one is playing: stop the first, start the
    // new one.
    if (playingId !== null) {
      audio.pause();
      audio.currentTime = 0;
      setPlayingId(null);
    }

    setLoadingId(id);
    setPreviews((p) => p + 1);
    // Endpoint redirects to a CDN-cached MP3 on hit, or synthesizes-then-
    // redirects on miss. Either way the audio element follows the 302.
    audio.src = `/api/voice-sample?locale=${encodeURIComponent(locale)}&voice=${encodeURIComponent(id)}`;
    audio.onloadeddata = () => {
      setLoadingId(null);
      setPlayingId(id);
    };
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => {
      setLoadingId(null);
      setPlayingId(null);
    };
    try {
      await audio.play();
    } catch {
      setLoadingId(null);
      setPlayingId(null);
    }
  }

  async function save(advance: boolean) {
    clearError();
    try {
      // Stop preview before navigating.
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
      await upsert.mutateAsync({
        step: advance ? 'consent' : 'voice',
        patch: { child: { voiceId } },
      });
      router.push(advance ? '/onboarding/consent' : '/onboarding/vocabulary_level');
    } catch (e) {
      captureError(e);
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-fg text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
        <p className="text-fg-muted text-base leading-relaxed">{t('subtitle')}</p>
      </header>
      <fieldset className="space-y-2">
        <legend className="sr-only">{t('legend')}</legend>
        {VOICES.map((v) => {
          const isPlaying = playingId === v.id;
          const isLoading = loadingId === v.id;
          return (
            <label
              key={v.id}
              className="border-border bg-bg-elevated has-[:checked]:border-primary has-[:checked]:bg-primary/5 flex cursor-pointer items-center gap-3 rounded-2xl border p-4"
            >
              <input
                type="radio"
                name="voice"
                value={v.id}
                checked={voiceId === v.id}
                onChange={() => setVoiceId(v.id)}
                className="text-primary h-4 w-4"
              />
              <span className="flex-1">
                <span className="text-fg block text-sm font-semibold">
                  {t(`voices.${v.id}.label`)}
                </span>
                <span className="text-fg-muted mt-0.5 block text-xs">
                  {t(`voices.${v.id}.description`)}
                </span>
              </span>
              <button
                type="button"
                onClick={(e) => {
                  // Don't toggle the radio when the user is just hitting
                  // the preview button.
                  e.preventDefault();
                  void togglePreview(v.id);
                }}
                disabled={isLoading || (previews >= MAX_PREVIEWS && !isPlaying)}
                aria-label={isPlaying ? t('previewStop') : t('preview')}
                aria-pressed={isPlaying}
                className="text-primary disabled:text-fg-subtle hover:bg-primary/5 inline-flex h-9 w-9 items-center justify-center rounded-full"
              >
                {isLoading ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : isPlaying ? (
                  <Pause aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <Play aria-hidden="true" className="h-4 w-4" />
                )}
              </button>
            </label>
          );
        })}
      </fieldset>
      <p className="text-fg-subtle text-xs">
        {t('previewsRemaining', { remaining: Math.max(0, MAX_PREVIEWS - previews) })}
      </p>
      <WizardActions
        backHref="/onboarding/vocabulary_level"
        onNext={() => save(true)}
        onSaveLater={() => save(false)}
        pending={upsert.isPending}
        error={errorMessage}
      />
    </section>
  );
}
