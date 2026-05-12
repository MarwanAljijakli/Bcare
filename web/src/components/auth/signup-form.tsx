'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition, useId, useMemo, type FormEvent } from 'react';
import { CheckEmailState } from './check-email-state';
import { PasswordInput } from './password-input';
import { RoleSelector } from './role-selector';
import type { AppLocale } from '@/i18n/routing';
import type { SignupRole } from '@/lib/auth/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from '@/i18n/routing';
import { scorePassword } from '@/lib/auth/strength';
import { cn } from '@/lib/cn';
import { useReducedMotion } from '@/lib/motion';

type FormState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; code: ServerErrorCode };

type ServerErrorCode =
  | 'userExists'
  | 'rateLimited'
  | 'serverUnreachable'
  | 'unconfigured'
  | 'unknown';

interface FieldErrors {
  role?: string;
  fullName?: string;
  email?: string;
  schoolName?: string;
  password?: string;
  passwordConfirm?: string;
  consent?: string;
}

/**
 * Production signup — password + email-verification only. Phase 10.C
 * removed the magic-link option from the UI (the API route still
 * accepts `method:'magic-link'` for the support runbook). On submit:
 *
 *   1. POST /api/auth/signup with method:'password'
 *   2. Supabase fires its built-in "Confirm signup" email template
 *   3. User clicks the link → /auth/callback exchanges code for session
 *   4. /onboarding takes over from the cookie-bound session
 *
 * Validation is identical client + server (zod superRefine). The
 * password field also gets a confirmation mirror so accidental typos
 * surface before the email roundtrip.
 */
export function SignupForm({
  consentVersion,
  consentTextHash,
}: {
  consentVersion: string;
  consentTextHash: string;
}) {
  const t = useTranslations('marketing.auth.signup');
  const locale = useLocale() as AppLocale;
  const reduced = useReducedMotion();
  const errorBannerId = useId();

  const [role, setRole] = useState<SignupRole | undefined>(undefined);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [consentGranted, setConsentGranted] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [state, setState] = useState<FormState>({ kind: 'idle' });
  const [pending, startTransition] = useTransition();

  const submitting = pending || state.kind === 'submitting';

  const validate = useMemo(() => {
    return (opts: { touchAll: boolean }): FieldErrors => {
      const next: FieldErrors = {};
      if (opts.touchAll && !role) next.role = t('roleHelper');
      if (opts.touchAll || fullName.length > 0) {
        if (fullName.trim().length < 2 || fullName.length > 80) {
          next.fullName = t('fullNameError');
        }
      }
      if (opts.touchAll || email.length > 0) {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed) next.email = t('emailErrorRequired');
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) || trimmed.includes('..')) {
          next.email = t('emailErrorInvalid');
        }
      }
      if (role === 'school') {
        if (opts.touchAll && !schoolName.trim()) next.schoolName = t('schoolNameError');
      }
      if (opts.touchAll && !password) next.password = t('passwordErrorRequired');
      else if (password) {
        const s = scorePassword(password);
        if (password.length < 12) next.password = t('passwordErrorTooShort');
        else if (!s.meetsPolicy) next.password = t('passwordErrorWeak');
      }
      if (opts.touchAll || passwordConfirm.length > 0) {
        if (!passwordConfirm) {
          if (opts.touchAll) next.passwordConfirm = t('passwordConfirmErrorRequired');
        } else if (passwordConfirm !== password) {
          next.passwordConfirm = t('passwordConfirmErrorMismatch');
        }
      }
      if (opts.touchAll && !consentGranted) next.consent = t('consentError');
      return next;
    };
  }, [role, fullName, email, schoolName, password, passwordConfirm, consentGranted, t]);

  function blurField(field: keyof FieldErrors) {
    setFieldErrors((prev) => {
      const fresh = validate({ touchAll: false });
      return { ...prev, [field]: fresh[field] };
    });
  }
  function changeAndClear(field: keyof FieldErrors, _next: string) {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errors = validate({ touchAll: true });
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    setState({ kind: 'submitting' });
    startTransition(async () => {
      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method: 'password',
            email: email.trim().toLowerCase(),
            fullName: fullName.trim(),
            role,
            ...(role === 'school' ? { schoolName: schoolName.trim() } : {}),
            password,
            consent: { granted: true, version: consentVersion, textHash: consentTextHash },
            locale,
          }),
        });

        if (res.status === 201) {
          setState({ kind: 'sent', email: email.trim().toLowerCase() });
          return;
        }

        const code = mapStatusToErrorCode(res.status);
        setState({ kind: 'error', code });
      } catch {
        setState({ kind: 'error', code: 'serverUnreachable' });
      }
    });
  }

  function reset() {
    setState({ kind: 'idle' });
  }

  // ==== Render =============================================================

  if (state.kind === 'sent') {
    return (
      <CheckEmailState
        email={state.email}
        i18nNamespace="marketing.auth.signup"
        bodyKey="bodyPassword"
        onResend={async () => {
          await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              method: 'password',
              email: state.email,
              fullName: fullName.trim(),
              role,
              ...(role === 'school' ? { schoolName: schoolName.trim() } : {}),
              password,
              consent: { granted: true, version: consentVersion, textHash: consentTextHash },
              locale,
            }),
          }).catch(() => {});
        }}
        onUseDifferent={reset}
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

      <RoleSelector
        value={role}
        onChange={(v) => {
          setRole(v);
          changeAndClear('role', v);
        }}
        invalid={!!fieldErrors.role}
        disabled={submitting}
      />
      {fieldErrors.role && (
        <p role="alert" className="text-danger -mt-3 text-xs leading-relaxed">
          {fieldErrors.role}
        </p>
      )}

      <div>
        <Label htmlFor="signup-fullname">{t('fullNameLabel')}</Label>
        <Input
          id="signup-fullname"
          name="fullName"
          autoComplete="name"
          required
          minLength={2}
          maxLength={80}
          placeholder={t('fullNamePlaceholder')}
          className="mt-2"
          value={fullName}
          onChange={(e) => {
            setFullName(e.target.value);
            changeAndClear('fullName', e.target.value);
          }}
          onBlur={() => blurField('fullName')}
          aria-invalid={!!fieldErrors.fullName || undefined}
          aria-describedby={fieldErrors.fullName ? 'signup-fullname-error' : undefined}
          disabled={submitting}
        />
        {fieldErrors.fullName && (
          <p id="signup-fullname-error" role="alert" className="text-danger mt-1.5 text-xs">
            {fieldErrors.fullName}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="signup-email">{t('emailLabel')}</Label>
        <Input
          id="signup-email"
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
            changeAndClear('email', e.target.value);
          }}
          onBlur={() => blurField('email')}
          aria-invalid={!!fieldErrors.email || undefined}
          aria-describedby={fieldErrors.email ? 'signup-email-error' : undefined}
          disabled={submitting}
        />
        {fieldErrors.email && (
          <p id="signup-email-error" role="alert" className="text-danger mt-1.5 text-xs">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <AnimatePresence initial={false}>
        {role === 'school' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: reduced ? 0 : 0.18, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-px">
              <Label htmlFor="signup-school">{t('schoolNameLabel')}</Label>
              <Input
                id="signup-school"
                name="schoolName"
                autoComplete="organization"
                placeholder={t('schoolNamePlaceholder')}
                className="mt-2"
                value={schoolName}
                onChange={(e) => {
                  setSchoolName(e.target.value);
                  changeAndClear('schoolName', e.target.value);
                }}
                onBlur={() => blurField('schoolName')}
                aria-invalid={!!fieldErrors.schoolName || undefined}
                aria-describedby={fieldErrors.schoolName ? 'signup-school-error' : undefined}
                disabled={submitting}
              />
              {fieldErrors.schoolName && (
                <p id="signup-school-error" role="alert" className="text-danger mt-1.5 text-xs">
                  {fieldErrors.schoolName}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <Label htmlFor="signup-password">{t('passwordLabel')}</Label>
        <PasswordInput
          id="signup-password"
          name="password"
          autoComplete="new-password"
          placeholder={t('passwordPlaceholder')}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            changeAndClear('password', e.target.value);
          }}
          onBlur={() => blurField('password')}
          showStrength
          error={fieldErrors.password ?? null}
          disabled={submitting}
          className="mt-2"
        />
      </div>

      <div>
        <Label htmlFor="signup-password-confirm">{t('passwordConfirmLabel')}</Label>
        <PasswordInput
          id="signup-password-confirm"
          name="passwordConfirm"
          autoComplete="new-password"
          placeholder={t('passwordConfirmPlaceholder')}
          value={passwordConfirm}
          onChange={(e) => {
            setPasswordConfirm(e.target.value);
            changeAndClear('passwordConfirm', e.target.value);
          }}
          onBlur={() => blurField('passwordConfirm')}
          error={fieldErrors.passwordConfirm ?? null}
          disabled={submitting}
          className="mt-2"
        />
      </div>

      <ConsentCheckbox
        granted={consentGranted}
        onToggle={(g) => {
          setConsentGranted(g);
          changeAndClear('consent', g ? 'ok' : '');
        }}
        error={fieldErrors.consent}
        disabled={submitting}
      />

      <div className="space-y-2">
        <Button type="submit" size="lg" disabled={submitting} className="w-full">
          {submitting ? (
            <>
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              {t('submitting')}
            </>
          ) : (
            <>
              {t('primary')}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </>
          )}
        </Button>
        <p className="text-fg-subtle text-center text-xs">{t('primaryHelper')}</p>
      </div>

      <p className="text-fg-muted text-center text-sm">
        {t('haveAccount')}{' '}
        <Link
          href="/login"
          className="text-primary focus-visible:ring-ring rounded font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {t('signInLink')}
        </Link>
      </p>
    </form>
  );
}

function ConsentCheckbox({
  granted,
  onToggle,
  error,
  disabled,
}: {
  granted: boolean;
  onToggle: (next: boolean) => void;
  error?: string;
  disabled?: boolean;
}) {
  const t = useTranslations('marketing.auth.signup');
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className={cn(
          'border-border bg-bg-elevated has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5 flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors',
          error && 'border-danger/60',
          disabled && 'pointer-events-none opacity-60',
        )}
      >
        <input
          id={id}
          type="checkbox"
          required
          checked={granted}
          onChange={(e) => onToggle(e.target.checked)}
          disabled={disabled}
          className={cn(
            'border-border-strong text-primary focus-visible:ring-ring mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          )}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <span className="text-fg-muted text-sm leading-relaxed">
          {t('consentLabelStart')}
          <Link
            href="/terms"
            target="_blank"
            className="text-primary font-semibold underline-offset-2 hover:underline"
          >
            {t('consentLabelTerms')}
          </Link>
          {t('consentLabelMiddle')}
          <Link
            href="/privacy"
            target="_blank"
            className="text-primary font-semibold underline-offset-2 hover:underline"
          >
            {t('consentLabelPrivacy')}
          </Link>
          {t('consentLabelEnd')}
        </span>
      </label>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-danger mt-1.5 text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

function ServerErrorMessage({ code }: { code: ServerErrorCode }) {
  const t = useTranslations('marketing.auth.signup.errors');
  if (code === 'userExists') {
    return (
      <span>
        {t('userExists')}{' '}
        <Link
          href="/login"
          className="text-fg font-semibold underline underline-offset-2 hover:opacity-90"
        >
          {t('userExistsAction')}
        </Link>
      </span>
    );
  }
  return <span>{t(code)}</span>;
}

function mapStatusToErrorCode(status: number): ServerErrorCode {
  if (status === 409) return 'userExists';
  if (status === 429) return 'rateLimited';
  if (status === 503) return 'unconfigured';
  if (status >= 500) return 'serverUnreachable';
  return 'unknown';
}
