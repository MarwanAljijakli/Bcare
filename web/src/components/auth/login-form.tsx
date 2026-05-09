'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition, useId, type FormEvent } from 'react';
import { CheckEmailState } from './check-email-state';
import { PasswordInput } from './password-input';
import type { AppLocale } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from '@/i18n/routing';
import { useReducedMotion } from '@/lib/motion';

type Method = 'magic-link' | 'password';
type FormState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'sent'; email: string }
  | { kind: 'signed-in' }
  | { kind: 'error'; code: ServerErrorCode };

type ServerErrorCode =
  | 'userNotFound'
  | 'invalidCredentials'
  | 'rateLimited'
  | 'serverUnreachable'
  | 'unconfigured'
  | 'unknown';

interface FieldErrors {
  email?: string;
  password?: string;
}

export function LoginForm() {
  const t = useTranslations('marketing.auth.login');
  const locale = useLocale() as AppLocale;
  const reduced = useReducedMotion();
  const errorBannerId = useId();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [method, setMethod] = useState<Method>('magic-link');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [state, setState] = useState<FormState>({ kind: 'idle' });
  const [pending, startTransition] = useTransition();

  const submitting = pending || state.kind === 'submitting';

  function validate(touchAll: boolean): FieldErrors {
    const next: FieldErrors = {};
    if (touchAll || email.length > 0) {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed) next.email = t('errors.userNotFound');
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) next.email = t('errors.userNotFound');
    }
    if (method === 'password') {
      if (touchAll && !password) next.password = t('errors.invalidCredentials');
    }
    return next;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errors = validate(true);
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    setState({ kind: 'submitting' });
    startTransition(async () => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method,
            email: email.trim().toLowerCase(),
            ...(method === 'password' ? { password } : {}),
            locale,
          }),
        });

        if (res.ok) {
          if (method === 'magic-link') {
            setState({ kind: 'sent', email: email.trim().toLowerCase() });
          } else {
            // Password login → server set the session cookie; reload home.
            // (Module 2.B will redirect to a real onboarding/dashboard route
            // depending on whether onboarding is complete.)
            window.location.href = `/${locale}`;
          }
          return;
        }

        const code = mapStatusToErrorCode(res.status);
        setState({ kind: 'error', code });
      } catch {
        setState({ kind: 'error', code: 'serverUnreachable' });
      }
    });
  }

  if (state.kind === 'sent') {
    return (
      <CheckEmailState
        email={state.email}
        i18nNamespace="marketing.auth.login"
        bodyKey="body"
        onResend={async () => {
          await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ method: 'magic-link', email: state.email, locale }),
          }).catch(() => {});
        }}
        onUseDifferent={() => setState({ kind: 'idle' })}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={submitting} className="space-y-6">
      <header className="space-y-2">
        <p className="text-primary inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
          <span aria-hidden="true" className="bg-primary h-1.5 w-1.5 rounded-full" />
          {t('eyebrow')}
        </p>
        <h1 className="text-fg text-balance text-3xl font-bold leading-tight tracking-tight md:text-4xl">
          {t('title')}
        </h1>
        <p className="text-fg-muted text-balance text-base leading-relaxed">{t('subtitle')}</p>
      </header>

      {state.kind === 'error' && (
        <div
          id={errorBannerId}
          role="alert"
          className="border-danger/30 bg-danger/5 text-danger rounded-xl border px-4 py-3 text-sm leading-relaxed"
        >
          <ServerErrorMessage code={state.code} />
        </div>
      )}

      <div>
        <Label htmlFor="login-email">{t('emailLabel')}</Label>
        <Input
          id="login-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder={t('emailPlaceholder')}
          className="mt-2"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setFieldErrors((p) => ({ ...p, email: undefined }));
          }}
          aria-invalid={!!fieldErrors.email || undefined}
          aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
          disabled={submitting}
        />
        {fieldErrors.email && (
          <p id="login-email-error" role="alert" className="text-danger mt-1.5 text-xs">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <AnimatePresence initial={false}>
        {method === 'password' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: reduced ? 0 : 0.18, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-px">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password">{t('passwordLabel')}</Label>
                <Link
                  href="/reset-password"
                  className="text-primary focus-visible:ring-ring rounded text-xs font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                >
                  {t('forgotPassword')}
                </Link>
              </div>
              <PasswordInput
                id="login-password"
                name="password"
                autoComplete="current-password"
                placeholder={t('passwordPlaceholder')}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFieldErrors((p) => ({ ...p, password: undefined }));
                }}
                error={fieldErrors.password ?? null}
                disabled={submitting}
                i18nNamespace="marketing.auth.login"
                className="mt-2"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        <Button type="submit" size="lg" disabled={submitting} className="w-full">
          {submitting ? (
            <>
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              {t('submitting')}
            </>
          ) : (
            <>
              {method === 'magic-link' ? t('primaryMagicLink') : t('primaryPassword')}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </>
          )}
        </Button>
        {method === 'magic-link' && (
          <p className="text-fg-subtle text-center text-xs">{t('primaryMagicLinkHelper')}</p>
        )}
        <button
          type="button"
          onClick={() => setMethod((m) => (m === 'magic-link' ? 'password' : 'magic-link'))}
          disabled={submitting}
          className="text-primary focus-visible:ring-ring mx-auto block rounded text-xs font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {method === 'magic-link' ? t('togglePassword') : t('toggleMagicLink')}
        </button>
      </div>

      <p className="text-fg-muted text-center text-sm">
        {t('needAccount')}{' '}
        <Link
          href="/signup"
          className="text-primary focus-visible:ring-ring rounded font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {t('signUpLink')}
        </Link>
      </p>
    </form>
  );
}

function ServerErrorMessage({ code }: { code: ServerErrorCode }) {
  const t = useTranslations('marketing.auth.login.errors');
  if (code === 'userNotFound') {
    return (
      <span>
        {t('userNotFound')}{' '}
        <Link
          href="/signup"
          className="text-fg font-semibold underline underline-offset-2 hover:opacity-90"
        >
          {t('userNotFoundAction')}
        </Link>
      </span>
    );
  }
  return <span>{t(code)}</span>;
}

function mapStatusToErrorCode(status: number): ServerErrorCode {
  if (status === 401) return 'invalidCredentials';
  if (status === 404) return 'userNotFound';
  if (status === 429) return 'rateLimited';
  if (status === 503) return 'unconfigured';
  if (status >= 500) return 'serverUnreachable';
  return 'unknown';
}
