'use client';

import { ArrowLeft, Check, Loader2, RefreshCw, Sparkles, ThumbsUp, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { trpc } from '@/lib/trpc/client';

const REJECTION_REASONS = [
  'not_relevant',
  'not_yet',
  'wrong_category',
  'duplicate',
  'other',
] as const;
type RejectionReason = (typeof REJECTION_REASONS)[number];

/**
 * /dashboard/personalization client surface.
 *
 * Renders pending vocabulary suggestions for the active child + provides
 * the AI suggestion-mode toggle and a "run now" button (manual recompute).
 *
 * No analytics SDK is loaded here — child usage data drives the
 * suggestions, but the only thing that ever hits a third-party network
 * is the optional GPT-4o-mini call (gated by aiGuard + caregiver toggle
 * + OPENAI_API_KEY presence).
 */
export function PersonalizationClient({
  childId,
  childName,
}: {
  childId: string;
  childName: string;
}) {
  const t = useTranslations('marketing.app.personalization');
  const tCommon = useTranslations('common');

  const pendingQ = trpc.personalization.listPending.useQuery({ childId });
  const toggleQ = trpc.personalization.toggle.get.useQuery({ childId });
  const utils = trpc.useUtils();

  const approve = trpc.personalization.approve.useMutation({
    onSuccess: () => utils.personalization.listPending.invalidate({ childId }),
  });
  const reject = trpc.personalization.reject.useMutation({
    onSuccess: () => utils.personalization.listPending.invalidate({ childId }),
  });
  const setMode = trpc.personalization.toggle.set.useMutation({
    onSuccess: () => utils.personalization.toggle.get.invalidate({ childId }),
  });
  const runNow = trpc.personalization.runNow.useMutation({
    onSuccess: () => {
      void utils.personalization.listPending.invalidate({ childId });
    },
  });

  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const suggestions = pendingQ.data ?? [];
  const toggleData = toggleQ.data;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-border bg-bg/80 sticky top-0 z-20 border-b backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              aria-label={tCommon('appName')}
              className="focus-visible:ring-ring -m-2 inline-flex items-center gap-2 rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              <Logo size="md" wordmark="auto" />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <div className="container flex flex-1 flex-col gap-8 py-8">
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              {t('backToDashboard')}
            </Link>
          </Button>
        </div>

        <header className="space-y-3">
          <p className="text-fg-subtle text-xs font-semibold uppercase tracking-wide">
            {t('eyebrow')}
          </p>
          <h1 className="text-fg text-balance text-3xl font-bold tracking-tight md:text-4xl">
            {childName ? t('greetingFor', { name: childName }) : t('title')}
          </h1>
          <p className="text-fg-muted max-w-2xl text-base leading-relaxed">{t('subtitle')}</p>
        </header>

        {/* AI suggestion mode + Run Now */}
        <section
          aria-labelledby="ai-mode-heading"
          className="border-border bg-bg-elevated rounded-2xl border p-5"
        >
          <h2
            id="ai-mode-heading"
            className="text-fg flex items-center gap-2 text-lg font-semibold"
          >
            <Sparkles aria-hidden="true" className="text-primary h-5 w-5" />
            {t('mode.title')}
          </h2>
          <p className="text-fg-muted mt-1 text-sm leading-relaxed">{t('mode.body')}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {(['review', 'auto'] as const).map((m) => {
              const active = toggleData?.mode === m;
              return (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={active ? 'primary' : 'secondary'}
                  onClick={() => setMode.mutate({ childId, mode: m })}
                  disabled={setMode.isPending}
                >
                  {t(`mode.${m}`)}
                </Button>
              );
            })}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => runNow.mutate({ childId })}
              disabled={runNow.isPending}
            >
              {runNow.isPending ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
              )}
              {t('mode.runNow')}
            </Button>
            {toggleData?.llmAvailable === false && (
              <span className="text-fg-subtle ms-auto text-xs">{t('mode.llmUnavailable')}</span>
            )}
          </div>
        </section>

        {/* Pending suggestions list */}
        <section aria-labelledby="suggestions-heading" className="space-y-3">
          <h2 id="suggestions-heading" className="text-fg text-lg font-semibold">
            {t('pending.title', { n: suggestions.length })}
          </h2>

          {pendingQ.isLoading && (
            <div className="text-fg-muted flex items-center gap-2 text-sm">
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              {t('pending.loading')}
            </div>
          )}
          {!pendingQ.isLoading && suggestions.length === 0 && (
            <div className="border-border bg-bg-elevated rounded-2xl border border-dashed p-8 text-center">
              <Sparkles aria-hidden="true" className="text-fg-subtle mx-auto h-8 w-8" />
              <h3 className="text-fg mt-3 text-base font-semibold">{t('pending.emptyTitle')}</h3>
              <p className="text-fg-muted mt-1 text-sm leading-relaxed">{t('pending.emptyBody')}</p>
            </div>
          )}

          <ul className="space-y-3">
            {suggestions.map((s) => {
              const isRejecting = rejectingId === s.id;
              return (
                <li
                  key={s.id}
                  className="border-border bg-bg-elevated flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-start"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-fg text-sm font-semibold">
                      {t('pending.itemTitle', { source: t(`source.${s.source}`) })}
                    </p>
                    <p className="text-fg-muted mt-1 font-mono text-xs">
                      {/* The dashboard doesn't yet hydrate the symbol's
                       *  EN/AR labels — Module 6 adds the symbol joiner.
                       *  For now we surface the symbol id which is enough
                       *  for caregiver review against their board. */}
                      {s.symbol_id.slice(0, 8)}…
                    </p>
                    {s.reason && <p className="text-fg-muted mt-1 text-xs">{s.reason}</p>}
                    <p className="text-fg-subtle mt-2 text-xs">
                      {t('pending.score', { score: (s.score * 100).toFixed(0) })}
                    </p>
                  </div>

                  {!isRejecting ? (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => approve.mutate({ suggestionId: s.id })}
                        disabled={approve.isPending}
                      >
                        <Check aria-hidden="true" className="h-3.5 w-3.5" />
                        {t('pending.approve')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setRejectingId(s.id)}
                      >
                        <X aria-hidden="true" className="h-3.5 w-3.5" />
                        {t('pending.reject')}
                      </Button>
                    </div>
                  ) : (
                    <div className="border-border bg-bg w-full rounded-xl border p-3 sm:max-w-xs">
                      <p className="text-fg-muted mb-2 text-xs font-semibold uppercase tracking-wide">
                        {t('pending.rejectReasonTitle')}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {REJECTION_REASONS.map((r: RejectionReason) => (
                          <Button
                            key={r}
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              reject.mutate(
                                { suggestionId: s.id, reason: r },
                                {
                                  onSettled: () => setRejectingId(null),
                                },
                              );
                            }}
                          >
                            {t(`pending.reasons.${r}`)}
                          </Button>
                        ))}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="mt-1"
                        onClick={() => setRejectingId(null)}
                      >
                        {t('pending.cancelReject')}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <footer className="text-fg-subtle border-border border-t pt-4 text-xs leading-relaxed">
          <ThumbsUp aria-hidden="true" className="me-2 inline-block h-3.5 w-3.5" />
          {t('footnote')}
        </footer>
      </div>
    </div>
  );
}
