'use client';

import { ArrowLeft, Check, Lock, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { trpc } from '@/lib/trpc/client';

const THEMES = ['default', 'animal', 'nature', 'space', 'ocean'] as const;
type ThemeKey = (typeof THEMES)[number];

const THRESHOLDS: Record<ThemeKey, number> = {
  default: 0,
  animal: 5,
  nature: 15,
  space: 30,
  ocean: 50,
};

/**
 * Caregiver-only theme picker. Renders 5 cards (default + four
 * unlockable). Shows current streak + total stars at the top — the only
 * "achievement" surface in BlueCare. NO leaderboards, NO comparisons
 * across children, NO time pressure.
 */
export function ThemesClient({ childId, childName }: { childId: string; childName: string }) {
  const t = useTranslations('marketing.app.themes');
  const tCommon = useTranslations('common');
  const stateQ = trpc.gamification.getState.useQuery({ childId });
  const utils = trpc.useUtils();
  const setSelected = trpc.gamification.setSelectedTheme.useMutation({
    onSuccess: () => utils.gamification.getState.invalidate({ childId }),
  });

  const state = stateQ.data;
  const totalStars = state?.total_stars ?? 0;
  const streak = state?.current_streak_days ?? 0;
  const longest = state?.longest_streak_days ?? 0;
  const unlocked = new Set<ThemeKey>(
    (state?.unlocked_themes as ThemeKey[] | undefined) ?? ['default'],
  );
  const selected = (state?.selected_theme as ThemeKey | null) ?? 'default';

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-border bg-bg/80 sticky top-0 z-20 border-b backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-3">
          <Link
            href="/dashboard"
            aria-label={tCommon('appName')}
            className="focus-visible:ring-ring -m-2 inline-flex items-center gap-2 rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <Logo size="md" wordmark="auto" />
          </Link>
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

        {/* Calm achievement summary — no comparisons, no time pressure. */}
        <section className="border-border bg-bg-elevated grid grid-cols-1 gap-3 rounded-2xl border p-5 sm:grid-cols-3">
          <Stat
            label={t('stats.totalStars')}
            value={`${totalStars}`}
            icon={<Star className="text-warning h-5 w-5 fill-current" />}
          />
          <Stat
            label={t('stats.streak')}
            value={`${streak}`}
            icon={<Star className="text-primary h-5 w-5" />}
          />
          <Stat
            label={t('stats.longest')}
            value={`${longest}`}
            icon={<Star className="text-fg-muted h-5 w-5" />}
          />
        </section>

        <p className="text-fg-muted text-sm leading-relaxed">{t('cap')}</p>

        {/* Theme picker grid. */}
        <section aria-labelledby="themes-heading" className="space-y-3">
          <h2 id="themes-heading" className="text-fg text-lg font-semibold">
            {t('grid.title')}
          </h2>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {THEMES.map((theme) => {
              const isUnlocked = unlocked.has(theme);
              const isSelected = selected === theme;
              const threshold = THRESHOLDS[theme];
              return (
                <li
                  key={theme}
                  className={`border-border bg-bg-elevated relative flex flex-col gap-3 rounded-2xl border-2 p-5 ${
                    isSelected ? 'border-primary' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-fg text-base font-bold">
                      {t(`grid.themes.${theme}.label`)}
                    </h3>
                    {isSelected && (
                      <span className="bg-primary text-primary-fg inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold">
                        <Check aria-hidden="true" className="h-3 w-3" />
                        {t('grid.selected')}
                      </span>
                    )}
                    {!isUnlocked && (
                      <span className="text-fg-subtle inline-flex items-center gap-1 text-xs font-semibold">
                        <Lock aria-hidden="true" className="h-3 w-3" />
                        {t('grid.locked')}
                      </span>
                    )}
                  </div>
                  <p className="text-fg-muted text-sm leading-relaxed">
                    {t(`grid.themes.${theme}.body`)}
                  </p>
                  <p className="text-fg-subtle text-xs">
                    {isUnlocked
                      ? t('grid.unlockedAt', { stars: threshold })
                      : t('grid.unlocksAt', { stars: threshold })}
                  </p>
                  <div className="mt-auto">
                    <Button
                      type="button"
                      size="sm"
                      variant={isSelected ? 'secondary' : 'primary'}
                      disabled={!isUnlocked || isSelected || setSelected.isPending}
                      onClick={() => setSelected.mutate({ childId, theme })}
                    >
                      {isSelected ? t('grid.alreadySelected') : t('grid.select')}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="bg-bg-muted grid h-10 w-10 place-items-center rounded-xl">
        {icon}
      </span>
      <div>
        <p className="text-fg-subtle text-xs font-semibold uppercase tracking-wide">{label}</p>
        <p className="text-fg text-2xl font-bold tabular-nums">{value}</p>
      </div>
    </div>
  );
}
