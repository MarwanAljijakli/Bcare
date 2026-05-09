import { GraduationCap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

/**
 * Authenticity strip — surfaces the academic origin of BlueCare. This is a
 * real authenticity signal for parents, therapists, and schools evaluating
 * the product. Renders as a single inline pill.
 */
export function TrustStrip() {
  const t = useTranslations('trustStrip');
  return (
    <div className="flex justify-center">
      <Link
        href="/team"
        className="border-border bg-bg-elevated text-fg-muted hover:text-fg focus-visible:ring-ring inline-flex max-w-full items-center gap-3 rounded-full border px-5 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        <GraduationCap aria-hidden="true" className="text-primary h-4 w-4 shrink-0" />
        <span className="truncate">
          {t('lead')} <span className="text-fg font-semibold">{t('institution')}</span>
          <span aria-hidden="true" className="text-fg-subtle mx-2">
            ·
          </span>
          <span className="text-fg-subtle">{t('supervisor')}</span>
        </span>
      </Link>
    </div>
  );
}
