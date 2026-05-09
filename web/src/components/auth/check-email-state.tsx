'use client';

import { Mail, ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface CheckEmailStateProps {
  /** The email we sent the link to — echoed in the body. */
  email: string;
  /** "marketing.auth.signup" or "marketing.auth.login" for namespacing. */
  i18nNamespace: 'marketing.auth.signup' | 'marketing.auth.login';
  /** Body translation key under "{namespace}.success" — "bodyMagic" / "bodyPassword" / "body". */
  bodyKey: 'bodyMagic' | 'bodyPassword' | 'body';
  /** Resend handler — disabled until countdown reaches 0. */
  onResend: () => void | Promise<void>;
  /** Take me back to fix the email handler. */
  onUseDifferent: () => void;
}

const RESEND_COOLDOWN_S = 60;

/**
 * Replaces the form on success of a magic-link / signup-with-password
 * submit. Provides a 60s resend cooldown countdown and a "wrong email?"
 * back-link that resets to the form.
 */
export function CheckEmailState({
  email,
  i18nNamespace,
  bodyKey,
  onResend,
  onUseDifferent,
}: CheckEmailStateProps) {
  const t = useTranslations(`${i18nNamespace}.success`);
  const [seconds, setSeconds] = useState(RESEND_COOLDOWN_S);
  const ready = seconds <= 0;

  useEffect(() => {
    if (ready) return;
    const id = window.setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [ready]);

  function handleResend() {
    setSeconds(RESEND_COOLDOWN_S);
    void onResend();
  }

  return (
    <section
      role="status"
      aria-live="polite"
      className="border-border bg-bg-elevated rounded-2xl border p-8 text-center shadow-sm"
    >
      <div className="bg-primary/10 text-primary mx-auto grid h-14 w-14 place-items-center rounded-2xl">
        <Mail aria-hidden="true" className="h-7 w-7" />
      </div>
      <h1 className="text-fg mt-6 text-balance text-2xl font-bold leading-tight tracking-tight md:text-3xl">
        {t('title')}
      </h1>
      <p className="text-fg-muted mx-auto mt-3 max-w-prose text-balance text-base leading-relaxed">
        {t(bodyKey, { email })}
      </p>

      <div className="mt-6 flex flex-col items-center gap-2.5">
        <Button
          type="button"
          size="md"
          variant="primary"
          disabled={!ready}
          onClick={handleResend}
          className="min-w-[12rem]"
        >
          {ready ? t('resendLabel') : t('resendCountdown', { seconds })}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onUseDifferent}>
          <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
          {t('useDifferent')}
        </Button>
      </div>
    </section>
  );
}
