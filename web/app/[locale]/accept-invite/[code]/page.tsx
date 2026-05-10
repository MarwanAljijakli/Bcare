import { setRequestLocale } from 'next-intl/server';
import { AcceptInviteClient } from './accept-invite-client';
import type { AppLocale } from '@/i18n/routing';
import { AppProviders } from '@/app/[locale]/providers';
import { ensureCsrfCookie } from '@/lib/auth/csrf';

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ locale: AppLocale; code: string }>;
}) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  await ensureCsrfCookie();
  return (
    <AppProviders>
      <main id="main" tabIndex={-1} className="bg-bg min-h-dvh">
        <div className="container flex min-h-dvh items-center justify-center py-10">
          <AcceptInviteClient code={code} />
        </div>
      </main>
    </AppProviders>
  );
}
