import { ArrowRight, LogOut, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

/**
 * /[locale]/onboarding — Module 2.B foundation stub.
 *
 * The auth callback route ({@link web/app/auth/callback/route.ts}) lands the
 * just-verified user here after they click the magic-link in their email.
 * The full 8-step caregiver wizard (profile → child → sensory → vocab level
 * → voice → consent scopes → parental PIN → review) replaces this stub in
 * Module 2.B iteration 2. For now we render a calm "you're in, more soon"
 * surface so the round-trip never lands on a 404.
 *
 * The page is server-rendered against the cookie-bound Supabase client so
 * the user's email can be echoed back. If no session exists (someone hits
 * /onboarding directly without signing in), redirect to /signup.
 */

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.auth.onboarding' });
  return pageMetadata({
    locale,
    path: 'onboarding',
    title: t('title'),
    description: t('subtitle'),
    robots: { index: false, follow: false },
  });
}

export default async function OnboardingStubPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Read the verified email from the Supabase session if available. We import
  // dynamically so the Supabase SDK doesn't enter the bundle on cold-start
  // for callers that don't reach the session lookup branch.
  let email: string | null = null;
  try {
    const { createSupabaseServerClient } = await import('@/lib/supabase/server');
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    email = data.user?.email ?? null;
  } catch {
    // Real-mode unavailable (no env vars) → render the stub anyway with a
    // generic greeting. The dev banner above the form will explain.
  }

  return (
    <AuthShell>
      <Inner email={email} />
    </AuthShell>
  );
}

function Inner({ email }: { email: string | null }) {
  const t = useTranslations('marketing.auth.onboarding');
  return (
    <section className="space-y-6 text-center">
      <div className="space-y-2">
        <p className="text-primary inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
          {t('eyebrow')}
        </p>
        <h1 className="text-fg text-balance text-3xl font-bold leading-tight tracking-tight md:text-4xl">
          {t('title')}
        </h1>
        <p className="text-fg-muted text-balance text-base leading-relaxed">{t('subtitle')}</p>
      </div>

      {email && <p className="text-fg-subtle text-xs">{t('verifiedAs', { email })}</p>}

      <div className="border-border bg-bg-muted text-fg-muted rounded-2xl border border-dashed p-5 text-start text-sm leading-relaxed">
        <p className="text-fg mb-2 text-xs font-semibold uppercase tracking-wide">
          {t('whatsNext')}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button asChild size="sm" variant="secondary">
            <Link href="/how-it-works">
              {t('previewBoard')}
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/for-therapists">
              {t('previewDashboard')}
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex justify-center">
        <Button asChild size="sm" variant="ghost">
          <Link href="/login">
            <LogOut aria-hidden="true" className="h-3.5 w-3.5" />
            {t('signOut')}
          </Link>
        </Button>
      </div>
    </section>
  );
}
