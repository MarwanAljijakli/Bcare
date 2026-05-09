import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

export default function LocaleNotFound() {
  const t = useTranslations('common.notFound');
  return (
    <main id="main" className="container py-24 text-center" tabIndex={-1}>
      <p className="text-primary text-sm font-semibold">404</p>
      <h1 className="text-fg mt-2 text-3xl font-bold">{t('title')}</h1>
      <p className="text-fg-muted mx-auto mt-4 max-w-prose">{t('description')}</p>
      <Link
        href="/"
        className="bg-primary text-primary-fg hover:bg-primary-hover focus-visible:ring-ring mt-8 inline-flex h-11 items-center rounded-full px-6 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        {t('goHome')}
      </Link>
    </main>
  );
}
