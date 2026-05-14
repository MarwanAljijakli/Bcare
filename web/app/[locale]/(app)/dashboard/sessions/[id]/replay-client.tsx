'use client';

import { ArrowLeft, Hand, Keyboard, Loader2, MousePointerClick, Save, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';
import { speakClient, VoiceServiceError } from '@/lib/voice/client';

interface Props {
  locale: 'en' | 'ar';
  sessionId: string;
}

const MODALITY_ICON = {
  symbol: MousePointerClick,
  speech: Volume2,
  gesture: Hand,
  keyboard: Keyboard,
} as const;

function formatDateTime(iso: string, locale: 'en' | 'ar'): string {
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatTime(iso: string, locale: 'en' | 'ar'): string {
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export function SessionReplayClient({ locale, sessionId }: Props) {
  const query = trpc.sessions.detail.useQuery({ sessionId });
  const updateNotes = trpc.sessions.updateNotes.useMutation({
    onSuccess: () => query.refetch(),
  });
  const utils = trpc.useUtils();

  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [speakError, setSpeakError] = useState<string | null>(null);

  if (query.isLoading) {
    return (
      <main className="container py-10">
        <div className="text-fg-muted flex items-center gap-2 text-sm">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {locale === 'ar' ? 'تحميل…' : 'Loading…'}
        </div>
      </main>
    );
  }
  if (query.error || !query.data) {
    return (
      <main className="container py-10">
        <p className="text-fg-muted text-sm">
          {locale === 'ar' ? 'تعذّر تحميل الجلسة.' : "Couldn't load this session."}
        </p>
        <Link
          href={`/${locale}/dashboard`}
          className="text-fg mt-4 inline-flex items-center gap-1 text-sm font-semibold underline"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          {locale === 'ar' ? 'عودة إلى لوحة القيادة' : 'Back to dashboard'}
        </Link>
      </main>
    );
  }

  const { session, child, events, symbols, callerRole } = query.data;
  const symbolMap = new Map(symbols.map((s) => [s.id, s]));
  const childName = child?.preferred_name?.trim() || child?.full_name?.trim() || 'Child';
  const currentNotes = notesDraft ?? session.therapist_notes ?? '';
  const notesDirty = notesDraft !== null && notesDraft !== (session.therapist_notes ?? '');

  // Build the assembled phrase from sequential symbol events.
  const assembled = events
    .map((e) => {
      const sym = e.symbol_id ? symbolMap.get(e.symbol_id) : null;
      if (!sym) return null;
      return locale === 'ar' ? sym.label_ar : sym.label_en;
    })
    .filter((label): label is string => typeof label === 'string' && label.length > 0)
    .join(' ');

  async function handleSpeak() {
    if (!assembled || !child) return;
    setSpeaking(true);
    setSpeakError(null);
    try {
      await speakClient({ text: assembled, lang: locale, childId: child.id });
    } catch (e) {
      setSpeakError(e instanceof VoiceServiceError ? e.kind : 'unknown');
    } finally {
      setSpeaking(false);
    }
  }

  async function handleSaveNotes() {
    if (notesDraft === null) return;
    await updateNotes.mutateAsync({ sessionId, notes: notesDraft });
    setNotesDraft(null);
    void utils.sessions.detail.invalidate({ sessionId });
  }

  return (
    <main className="container space-y-8 py-10">
      <header className="space-y-2">
        <Link
          href={`/${locale}/dashboard`}
          className="text-fg-muted hover:text-fg inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          {locale === 'ar' ? 'عودة إلى لوحة القيادة' : 'Back to dashboard'}
        </Link>
        <h1 className="text-fg text-3xl font-bold">
          {locale === 'ar' ? `جلسة ${childName}` : `${childName}'s session`}
        </h1>
        <p className="text-fg-muted text-sm">
          {formatDateTime(session.started_at, locale)} · {formatDuration(session.duration_seconds)}
        </p>
        {callerRole === 'therapist' && (
          <p className="text-fg-subtle text-xs italic">
            {locale === 'ar'
              ? 'تعرض هذه الجلسة كمعالج. لديك حق القراءة + كتابة الملاحظات فقط.'
              : 'Viewing as therapist — read access + notes editing only.'}
          </p>
        )}
      </header>

      <section aria-labelledby="metrics-heading" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <h2 id="metrics-heading" className="sr-only">
          {locale === 'ar' ? 'الأرقام' : 'Metrics'}
        </h2>
        <MetricCard
          label={locale === 'ar' ? 'الإدخالات' : 'Inputs'}
          value={String(session.input_count ?? 0)}
        />
        <MetricCard
          label={locale === 'ar' ? 'الإخراج' : 'Outputs'}
          value={String(session.output_count ?? 0)}
        />
        <MetricCard
          label={locale === 'ar' ? 'اختيارات ناجحة' : 'Successful'}
          value={String(session.successful_selections ?? 0)}
        />
        <MetricCard
          label={locale === 'ar' ? 'المدّة' : 'Duration'}
          value={formatDuration(session.duration_seconds)}
        />
      </section>

      <section aria-labelledby="phrase-heading" className="space-y-3">
        <h2 id="phrase-heading" className="text-fg text-lg font-bold">
          {locale === 'ar' ? 'الجملة المُجمَّعة' : 'Assembled phrase'}
        </h2>
        {assembled ? (
          <div
            className="border-border bg-bg-elevated flex flex-wrap items-center gap-3 rounded-2xl border p-4"
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
          >
            <p className="text-fg flex-1 text-lg font-semibold leading-snug">{assembled}</p>
            <Button
              type="button"
              size="md"
              onClick={handleSpeak}
              disabled={speaking || !child}
              aria-label={locale === 'ar' ? 'تشغيل الصوت' : 'Play speech'}
            >
              {speaking ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Volume2 aria-hidden="true" className="h-4 w-4" />
              )}
              <span className="ms-2">{locale === 'ar' ? 'استمع' : 'Speak'}</span>
            </Button>
          </div>
        ) : (
          <p className="text-fg-muted text-sm">
            {locale === 'ar'
              ? 'لا توجد رموز تم اختيارها في هذه الجلسة.'
              : 'No symbols were selected in this session.'}
          </p>
        )}
        {speakError && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {locale === 'ar' ? 'تعذّر التشغيل: ' : 'Could not play: '}
            {speakError}
          </p>
        )}
      </section>

      <section aria-labelledby="timeline-heading" className="space-y-3">
        <h2 id="timeline-heading" className="text-fg text-lg font-bold">
          {locale === 'ar' ? 'تسلسل الأحداث' : 'Event timeline'}
        </h2>
        {events.length === 0 ? (
          <p className="text-fg-muted text-sm">
            {locale === 'ar' ? 'لا توجد أحداث.' : 'No events.'}
          </p>
        ) : (
          <ol className="space-y-2">
            {events.map((ev, idx) => {
              const sym = ev.symbol_id ? symbolMap.get(ev.symbol_id) : null;
              const Icon = MODALITY_ICON[ev.modality];
              const label = sym ? (locale === 'ar' ? sym.label_ar : sym.label_en) : null;
              return (
                <li
                  key={ev.id}
                  className="border-border bg-bg-elevated flex items-center gap-3 rounded-xl border p-3"
                  dir={locale === 'ar' ? 'rtl' : 'ltr'}
                >
                  <span className="text-fg-subtle w-6 text-end text-xs tabular-nums">
                    {idx + 1}
                  </span>
                  <Icon aria-hidden="true" className="text-fg-muted h-4 w-4 flex-shrink-0" />
                  <span className="text-fg flex-1 text-sm font-medium" dir="auto">
                    {label || (
                      <span className="text-fg-subtle italic">
                        {locale === 'ar' ? `(${ev.modality})` : `(${ev.modality})`}
                      </span>
                    )}
                  </span>
                  <span className="text-fg-subtle text-xs tabular-nums">
                    {formatTime(ev.created_at, locale)}
                  </span>
                  {typeof ev.latency_ms === 'number' && ev.latency_ms > 0 && (
                    <span className="text-fg-subtle text-xs tabular-nums">{ev.latency_ms}ms</span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section aria-labelledby="notes-heading" className="space-y-3">
        <h2 id="notes-heading" className="text-fg text-lg font-bold">
          {locale === 'ar' ? 'ملاحظات المعالج' : 'Therapist notes'}
        </h2>
        <p className="text-fg-muted text-xs">
          {locale === 'ar'
            ? 'تُحفظ الملاحظات في سجل التدقيق. يمكن لمقدّم الرعاية والمعالج التحرير.'
            : 'Notes are written to the audit log. Caregiver + therapist can edit.'}
        </p>
        <textarea
          className="border-border bg-bg-elevated text-fg focus:ring-fg/30 min-h-[140px] w-full rounded-xl border p-3 text-sm leading-relaxed focus:outline-none focus:ring-2"
          dir="auto"
          value={currentNotes}
          maxLength={4096}
          onChange={(e) => setNotesDraft(e.target.value)}
          placeholder={
            locale === 'ar'
              ? 'مثل: ركّز الطفل اليوم على رموز الطعام…'
              : 'e.g. The child focused on food symbols today…'
          }
        />
        <div className="flex items-center justify-between">
          <span className="text-fg-subtle text-xs tabular-nums">{currentNotes.length} / 4096</span>
          <div className="flex items-center gap-2">
            {notesDirty && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setNotesDraft(null)}
                disabled={updateNotes.isPending}
              >
                {locale === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handleSaveNotes}
              disabled={!notesDirty || updateNotes.isPending}
            >
              {updateNotes.isPending ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Save aria-hidden="true" className="h-4 w-4" />
              )}
              <span className="ms-2">{locale === 'ar' ? 'حفظ' : 'Save'}</span>
            </Button>
          </div>
        </div>
        {updateNotes.error && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {locale === 'ar' ? 'تعذّر الحفظ' : 'Save failed'}: {updateNotes.error.message}
          </p>
        )}
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border-muted bg-bg-elevated rounded-xl border p-3">
      <p className="text-fg-subtle text-xs uppercase tracking-wide">{label}</p>
      <p className="text-fg mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
