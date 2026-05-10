'use client';

import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { trpc } from '@/lib/trpc/client';

type Status = 'idle' | 'accepting' | 'accepted' | 'error';

export function AcceptInviteClient({ code }: { code: string }) {
  const t = useTranslations('marketing.app.acceptInvite');
  const accept = trpc.invites.accept.useMutation();
  const [status, setStatus] = useState<Status>('idle');
  const [errorCode, setErrorCode] = useState<string>('unknown');

  useEffect(() => {
    let cancelled = false;
    setStatus('accepting');
    accept
      .mutateAsync({ code })
      .then(() => {
        if (!cancelled) setStatus('accepted');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setErrorCode(e instanceof Error ? e.message : 'unknown');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <section className="border-border bg-bg-elevated mx-auto w-full max-w-md rounded-2xl border p-8 text-center shadow-sm">
      {status === 'accepting' && (
        <>
          <Loader2 aria-hidden="true" className="text-primary mx-auto h-10 w-10 animate-spin" />
          <h1 className="text-fg mt-4 text-xl font-semibold">{t('accepting')}</h1>
        </>
      )}
      {status === 'accepted' && (
        <>
          <CheckCircle2 aria-hidden="true" className="text-success mx-auto h-12 w-12" />
          <h1 className="text-fg mt-4 text-2xl font-bold tracking-tight">{t('acceptedTitle')}</h1>
          <p className="text-fg-muted mt-2 text-sm leading-relaxed">{t('acceptedBody')}</p>
          <div className="mt-6">
            <Button asChild size="lg">
              <Link href="/dashboard">{t('cta')}</Link>
            </Button>
          </div>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle aria-hidden="true" className="text-warning mx-auto h-12 w-12" />
          <h1 className="text-fg mt-4 text-2xl font-bold tracking-tight">{t('errorTitle')}</h1>
          <p className="text-fg-muted mt-2 text-sm leading-relaxed">
            {t(`errors.${errorCode}` as 'errors.unknown')}
          </p>
          <div className="mt-6">
            <Button asChild size="md" variant="ghost">
              <Link href="/login">{t('back')}</Link>
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
