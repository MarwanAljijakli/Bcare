'use client';

import { Loader2, Play } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';

type VoiceKey = 'charlotte' | 'sarah';
const SPEEDS = [0.75, 1.0, 1.25] as const;

const COPY = {
  en: {
    title: 'Voice settings',
    subtitle: (name: string | null) =>
      name ? `How ${name}'s board sounds when it speaks.` : 'How the board sounds when it speaks.',
    voiceSection: 'Voice',
    voiceCharlotte: 'Charlotte (warm)',
    voiceSarah: 'Sarah (soft)',
    speedSection: 'Speed',
    autoPlaySection: 'Auto-play on Speak',
    autoPlayHelp:
      'When on, tapping the Speak button immediately reads the sentence aloud. Off lets a caregiver review the strip first.',
    autoPlayOn: 'On',
    autoPlayOff: 'Off',
    preview: 'Preview',
    saving: 'Saving…',
    saved: 'Saved',
  },
  ar: {
    title: 'إعدادات الصوت',
    subtitle: (name: string | null) =>
      name ? `كيف يبدو صوت لوحة ${name} عند النطق.` : 'كيف يبدو صوت اللوحة عند النطق.',
    voiceSection: 'الصوت',
    voiceCharlotte: 'شارلوت (دافئ)',
    voiceSarah: 'سارة (هادئ)',
    speedSection: 'السرعة',
    autoPlaySection: 'التشغيل التلقائي عند Speak',
    autoPlayHelp:
      'عند التفعيل، الضغط على زر Speak يقرأ الجملة فورًا. عند الإيقاف، تتاح لمراجعة الشريط أولًا.',
    autoPlayOn: 'مفعّل',
    autoPlayOff: 'متوقّف',
    preview: 'استمع',
    saving: 'يحفظ…',
    saved: 'تم الحفظ',
  },
};

export function VoiceSettingsClient({
  locale,
  childId,
  childName,
  initial,
}: {
  locale: 'en' | 'ar';
  childId: string;
  childName: string | null;
  initial: { voice: VoiceKey; speed: number; autoPlay: boolean };
}) {
  const t = COPY[locale];
  const [voice, setVoice] = useState<VoiceKey>(initial.voice);
  const [speed, setSpeed] = useState<number>(initial.speed);
  const [autoPlay, setAutoPlay] = useState<boolean>(initial.autoPlay);
  const [saved, setSaved] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const setSettings = trpc.voice.set.useMutation({
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    },
  });

  function commit(patch: { voice?: VoiceKey; speed?: number; autoPlay?: boolean }) {
    setSettings.mutate({ childId, ...patch });
  }

  async function preview() {
    setPreviewing(true);
    try {
      // Use the GET preview endpoint; it handles the cache for us.
      const url = `/api/voice-preview?voice=${voice}&locale=${locale}&child_id=${childId}`;
      const audio = new Audio(url);
      await audio.play();
      audio.addEventListener('ended', () => setPreviewing(false), { once: true });
    } catch {
      setPreviewing(false);
    }
  }

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-fg text-2xl font-bold">{t.title}</h1>
        <p className="text-fg-muted mt-1 text-sm">{t.subtitle(childName)}</p>
      </header>

      {/* Voice picker */}
      <section className="border-border bg-bg-elevated space-y-3 rounded-2xl border p-5">
        <h2 className="text-fg text-sm font-bold uppercase tracking-wide">{t.voiceSection}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={voice === 'charlotte' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => {
              setVoice('charlotte');
              commit({ voice: 'charlotte' });
            }}
          >
            {t.voiceCharlotte}
          </Button>
          <Button
            type="button"
            variant={voice === 'sarah' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => {
              setVoice('sarah');
              commit({ voice: 'sarah' });
            }}
          >
            {t.voiceSarah}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={previewing} onClick={preview}>
            {previewing ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <Play aria-hidden="true" className="h-4 w-4" />
            )}
            <span className="ms-2">{t.preview}</span>
          </Button>
        </div>
      </section>

      {/* Speed */}
      <section className="border-border bg-bg-elevated space-y-3 rounded-2xl border p-5">
        <h2 className="text-fg text-sm font-bold uppercase tracking-wide">{t.speedSection}</h2>
        <div className="flex items-center gap-2">
          {SPEEDS.map((s) => (
            <Button
              key={s}
              type="button"
              variant={Math.abs(speed - s) < 0.01 ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => {
                setSpeed(s);
                commit({ speed: s });
              }}
            >
              {s.toFixed(2)}×
            </Button>
          ))}
        </div>
      </section>

      {/* Auto-play */}
      <section className="border-border bg-bg-elevated space-y-3 rounded-2xl border p-5">
        <h2 className="text-fg text-sm font-bold uppercase tracking-wide">{t.autoPlaySection}</h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={autoPlay ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => {
              setAutoPlay(true);
              commit({ autoPlay: true });
            }}
          >
            {t.autoPlayOn}
          </Button>
          <Button
            type="button"
            variant={!autoPlay ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => {
              setAutoPlay(false);
              commit({ autoPlay: false });
            }}
          >
            {t.autoPlayOff}
          </Button>
        </div>
        <p className="text-fg-muted text-xs">{t.autoPlayHelp}</p>
      </section>

      <div className="text-fg-muted h-5 text-xs" role="status" aria-live="polite">
        {setSettings.isPending ? t.saving : saved ? t.saved : null}
      </div>
    </main>
  );
}
