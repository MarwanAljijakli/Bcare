'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Link } from '@/i18n/routing';

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common.error');
  useEffect(() => {
    // Surfaces are added in Module 9. For now, log so it's visible in `next dev`.
    if (process.env.NODE_ENV !== 'production') {
      console.error('[bluecare] route error', error);
    }
  }, [error]);

  return (
    <main id="main" className="container py-24 text-center" tabIndex={-1}>
      <h1 className="text-fg text-3xl font-bold">{t('title')}</h1>
      <p className="text-fg-muted mx-auto mt-4 max-w-prose">{t('description')}</p>
      <div className="mt-8 flex justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="bg-primary text-primary-fg hover:bg-primary-hover focus-visible:ring-ring inline-flex h-11 items-center rounded-full px-6 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {t('retry')}
        </button>
        <Link
          href="/"
          className="border-border bg-bg-elevated text-fg hover:bg-bg-muted focus-visible:ring-ring inline-flex h-11 items-center rounded-full border px-6 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {t('goHome')}
        </Link>
      </div>
    </main>
  );
}
