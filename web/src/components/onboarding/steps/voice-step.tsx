'use client';

import { Volume2, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { useStepError } from '../use-step-error';
import { WizardActions } from '../wizard-actions';
import { useRouter } from '@/i18n/routing';
import { trpc } from '@/lib/trpc/client';

const VOICES = [
  { id: 'voice-warm', preview: '/api/voice-preview?id=voice-warm' },
  { id: 'voice-clear', preview: '/api/voice-preview?id=voice-clear' },
  { id: 'voice-soft', preview: '/api/voice-preview?id=voice-soft' },
] as const;

const MAX_PREVIEWS = 3;

export function VoiceStep({ initial }: { initial: string | undefined }) {
  const t = useTranslations('marketing.auth.onboardingWizard.voice');
  const router = useRouter();
  const [voiceId, setVoiceId] = useState(initial ?? VOICES[0].id);
  const [previews, setPreviews] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { errorMessage, captureError, clearError } = useStepError();
  const upsert = trpc.onboarding.upsertDraft.useMutation();

  async function play(id: string) {
    if (previews >= MAX_PREVIEWS) return;
    setPlayingId(id);
    setPreviews((p) => p + 1);
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = `/api/voice-preview?id=${encodeURIComponent(id)}`;
    audioRef.current.onended = () => setPlayingId(null);
    audioRef.current.onerror = () => setPlayingId(null);
    try {
      await audioRef.current.play();
    } catch {
      setPlayingId(null);
    }
  }

  async function save(advance: boolean) {
    clearError();
    try {
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
        {VOICES.map((v) => (
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
              onClick={() => void play(v.id)}
              disabled={previews >= MAX_PREVIEWS || playingId !== null}
              aria-label={t('preview')}
              className="text-primary disabled:text-fg-subtle inline-flex h-9 w-9 items-center justify-center rounded-full"
            >
              {playingId === v.id ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Volume2 aria-hidden="true" className="h-4 w-4" />
              )}
            </button>
          </label>
        ))}
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
