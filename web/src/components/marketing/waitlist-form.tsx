'use client';

import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition, type FormEvent } from 'react';
import type { AppLocale } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';

type SubmitState = 'idle' | 'submitting' | 'success' | 'duplicate' | 'error';

const ROLE_VALUES = ['family', 'therapist', 'school', 'other'] as const;

/**
 * Waitlist form. Posts to /api/waitlist (Next.js Route Handler) which
 * inserts into the public.waitlist_signups table via Supabase. No third-
 * party form provider, no client-side analytics on the email value.
 *
 * Honeypot + zod-on-server defends against bots without showing a CAPTCHA
 * to humans.
 */
export function WaitlistForm() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations('marketing.pricing.form');
  const [state, setState] = useState<SubmitState>('idle');
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const payload = {
      email: String(formData.get('email') ?? ''),
      role: String(formData.get('role') ?? 'family'),
      locale,
      // Read-only marketing-page source — useful for analytics. Never includes
      // referrer URL or any tracking parameters.
      source: 'marketing/pricing',
      honeypot: String(formData.get('honeypot') ?? ''),
    };

    setState('submitting');
    startTransition(async () => {
      try {
        const res = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.status === 201) {
          setState('success');
          form.reset();
        } else if (res.status === 200) {
          setState('duplicate');
        } else {
          setState('error');
        }
      } catch {
        setState('error');
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="border-border bg-bg-elevated mx-auto max-w-xl rounded-2xl border p-6 shadow-sm md:p-8"
    >
      <h2 className="text-fg text-2xl font-bold tracking-tight">{t('title')}</h2>
      <p className="text-fg-muted mt-2 text-sm leading-relaxed">{t('subtitle')}</p>

      <div className="mt-6 space-y-5">
        <div>
          <Label htmlFor="email">{t('emailLabel')}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder={t('emailPlaceholder')}
            className="mt-2"
            aria-invalid={state === 'error' ? true : undefined}
          />
        </div>

        <fieldset>
          <legend className="text-fg text-sm font-medium leading-none">{t('roleLabel')}</legend>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {ROLE_VALUES.map((role, idx) => (
              <label
                key={role}
                className="border-border has-[:checked]:border-primary has-[:checked]:bg-primary/5 flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors"
              >
                <input
                  type="radio"
                  name="role"
                  value={role}
                  defaultChecked={idx === 0}
                  className="text-primary focus-visible:ring-ring h-4 w-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                />
                <span className="text-fg font-medium">{t(`role.${role}` as 'role.family')}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Honeypot — hidden from users, visible to many bots. */}
        <div aria-hidden="true" className="hidden">
          <label>
            {t('honeypotLabel')}
            <input type="text" name="honeypot" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </div>

        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? t('submitting') : t('submit')}
        </Button>

        <p className="text-fg-subtle text-xs leading-relaxed">{t('consentNote')}</p>

        {state === 'success' && (
          <p
            role="status"
            className={cn('text-success flex items-center gap-2 text-sm font-medium')}
          >
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
            {t('success')}
          </p>
        )}
        {state === 'duplicate' && (
          <p
            role="status"
            className={cn('text-fg-muted flex items-center gap-2 text-sm font-medium')}
          >
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
            {t('alreadyExists')}
          </p>
        )}
        {state === 'error' && (
          <p
            role="alert"
            className={cn('text-warning flex items-center gap-2 text-sm font-medium')}
          >
            <AlertCircle aria-hidden="true" className="h-4 w-4" />
            {t('error')}
          </p>
        )}
      </div>
    </form>
  );
}
