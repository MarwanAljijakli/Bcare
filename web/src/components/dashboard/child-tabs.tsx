import { useTranslations } from 'next-intl';
import type { AppLocale } from '@/i18n/routing';
import type { DashboardChild } from '@/server/dashboard/types';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/cn';
import { formatInteger } from '@/server/dashboard/format';

/**
 * Child tab strip — only renders when the caregiver has more than one
 * child. Uses native <a>/<Link> so keyboard nav works for free.
 *
 * Active selection is encoded in `?child=<id>` and survives RSC
 * re-renders without any client state.
 */
export function ChildTabs({
  children,
  activeChildId,
  locale,
}: {
  children: DashboardChild[];
  activeChildId: string | null;
  locale: AppLocale;
}) {
  const t = useTranslations('marketing.app.dashboard.v6');
  if (children.length <= 1) return null;
  return (
    <nav aria-label={t('child.tablistLabel')} className="flex flex-wrap gap-2">
      {children.map((c) => {
        const active = c.id === activeChildId;
        return (
          <Link
            key={c.id}
            href={{ pathname: '/dashboard', query: { child: c.id } }}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'focus-visible:ring-ring inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-bg-elevated text-fg hover:bg-bg-muted',
            )}
          >
            <span className="truncate">{c.name}</span>
            {c.ageYears !== null ? (
              <span className="text-fg-subtle text-xs font-normal tabular-nums">
                {t('child.ageYears', { count: formatInteger(c.ageYears, locale) })}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
