import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SHOW_DEV_BANNER } from '@/lib/auth/mode';

/**
 * Yellow banner shown ONLY in development + mock mode. In production it
 * never renders — the SHOW_DEV_BANNER constant is computed at module load
 * and dead-code-eliminated by the bundler in prod builds.
 */
export function DevModeBanner() {
  if (!SHOW_DEV_BANNER) return null;
  return <Banner />;
}

function Banner() {
  const t = useTranslations('marketing.auth.devBanner');
  return (
    <div
      role="status"
      aria-live="polite"
      className="border-warning/40 bg-secondary text-secondary-fg relative isolate border-y px-6 py-3"
    >
      <div className="container flex items-start gap-3">
        <TriangleAlert aria-hidden="true" className="text-warning mt-0.5 h-4 w-4 shrink-0" />
        <div className="text-xs leading-relaxed">
          <span className="font-semibold">{t('title')}.</span>{' '}
          <span className="opacity-90">{t('body')}</span>
        </div>
      </div>
    </div>
  );
}
