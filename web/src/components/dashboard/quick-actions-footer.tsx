import { Grid3x3, Settings, Sparkles, Wand2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

/**
 * Quick-actions footer — board / personalization / themes / settings.
 *
 * Replaces the placeholder dashboard's CTA card grid. Smaller, less
 * dominant; the dashboard now leads with stats, and these are the
 * "where do I go from here" rails at the bottom.
 *
 * All four destinations are real and shipped.
 */
export function QuickActionsFooter() {
  const t = useTranslations('marketing.app.dashboard.v6');
  return (
    <nav aria-label={t('quickActions.heading')}>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Action
          href="/board"
          label={t('quickActions.board')}
          icon={<Grid3x3 className="h-4 w-4" />}
        />
        <Action
          href="/dashboard/personalization"
          label={t('quickActions.personalization')}
          icon={<Wand2 className="h-4 w-4" />}
        />
        <Action
          href="/dashboard/themes"
          label={t('quickActions.themes')}
          icon={<Sparkles className="h-4 w-4" />}
        />
        <Action
          href="/settings/privacy"
          label={t('quickActions.settings')}
          icon={<Settings className="h-4 w-4" />}
        />
      </ul>
    </nav>
  );
}

function Action({
  href,
  label,
  icon,
}: {
  href: '/board' | '/dashboard/personalization' | '/dashboard/themes' | '/settings/privacy';
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="border-border bg-bg-elevated text-fg hover:border-primary/40 hover:bg-bg-muted focus-visible:ring-ring group flex h-full items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        <span
          aria-hidden="true"
          className="bg-primary/10 text-primary grid h-7 w-7 shrink-0 place-items-center rounded-lg"
        >
          {icon}
        </span>
        <span className="truncate">{label}</span>
        <span
          aria-hidden="true"
          className="text-fg-subtle ms-auto transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
        >
          →
        </span>
      </Link>
    </li>
  );
}
