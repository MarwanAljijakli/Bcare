import { Sprout } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';

/**
 * First-visit empty state — shown when the caregiver has zero children
 * (e.g. signed in via real signup but never finished onboarding). The
 * onboarding wizard finalize() lands here, so this branch should be
 * rare in practice.
 */
export function NewCaregiverEmpty() {
  const t = useTranslations('marketing.app.dashboard.v6');
  return (
    <section
      aria-labelledby="dashboard-empty-newcaregiver"
      className="border-border bg-bg-elevated rounded-2xl border p-8 text-center shadow-sm md:p-12"
    >
      <span
        aria-hidden="true"
        className="bg-primary/10 text-primary mx-auto grid h-14 w-14 place-items-center rounded-2xl"
      >
        <Sprout className="h-7 w-7" />
      </span>
      <h2
        id="dashboard-empty-newcaregiver"
        className="text-fg mt-5 text-xl font-bold leading-tight tracking-tight md:text-2xl"
      >
        {t('empty.newCaregiver.title')}
      </h2>
      <p className="text-fg-muted mx-auto mt-3 max-w-md text-sm leading-relaxed">
        {t('empty.newCaregiver.body')}
      </p>
      <div className="mt-6">
        <Button asChild>
          <Link href="/onboarding">{t('empty.newCaregiver.cta')}</Link>
        </Button>
      </div>
    </section>
  );
}
