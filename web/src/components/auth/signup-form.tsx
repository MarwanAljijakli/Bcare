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

type Method = 'magic-link' | 'password';
type FormState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'sent'; method: Method; email: string }
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
  consent?: string;
}

/**
 * The real signup form. Magic-link primary, password disclosure secondary.
 * Validation runs on blur and on submit; errors are kind, specific, and
 * inline-rendered. Form posts JSON to /api/auth/signup which adapts to
 * Supabase or the dev mock based on env-var presence.
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

  // Form state — controlled inputs so the strength meter, role-conditional
  // school field, and password disclosure all derive from a single source.
  const [role, setRole] = useState<SignupRole | undefined>(undefined);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [method, setMethod] = useState<Method>('magic-link');
  const [password, setPassword] = useState('');
  const [consentGranted, setConsentGranted] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [state, setState] = useState<FormState>({ kind: 'idle' });
  const [pending, startTransition] = useTransition();

  const submitting = pending || state.kind === 'submitting';

  /** Pure-function validator; returns FieldErrors with no UI side-effects. */
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
      if (method === 'password') {
        if (opts.touchAll && !password) next.password = t('passwordErrorRequired');
        else if (password) {
          const s = scorePassword(password);
          if (password.length < 12) next.password = t('passwordErrorTooShort');
          else if (!s.meetsPolicy) next.password = t('passwordErrorWeak');
        }
      }
      if (opts.touchAll && !consentGranted) next.consent = t('consentError');
      return next;
    };
  }, [role, fullName, email, schoolName, method, password, consentGranted, t]);

  /** Per-field blur handlers — touches just that field. */
  function blurField(field: keyof FieldErrors) {
    setFieldErrors((prev) => {
      const fresh = validate({ touchAll: false });
      return { ...prev, [field]: fresh[field] };
    });
  }
  /** Clear a field error as soon as the value looks valid. */
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
            method,
            email: email.trim().toLowerCase(),
            fullName: fullName.trim(),
            role,
            ...(role === 'school' ? { schoolName: schoolName.trim() } : {}),
            ...(method === 'password' ? { password } : {}),
            consent: { granted: true, version: consentVersion, textHash: consentTextHash },
            locale,
          }),
        });

        if (res.status === 201) {
          setState({ kind: 'sent', method, email: email.trim().toLowerCase() });
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
        bodyKey={state.method === 'magic-link' ? 'bodyMagic' : 'bodyPassword'}
        onResend={async () => {
          // Best-effort resend; same payload, ignore response (the countdown
          // resets regardless so a flake doesn't lock the user out).
          await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              method,
              email: state.email,
              fullName: fullName.trim(),
              role,
              ...(role === 'school' ? { schoolName: schoolName.trim() } : {}),
              ...(method === 'password' ? { password } : {}),
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
            // overflow-hidden so the height transition doesn't reveal the
            // input mid-animation.
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
          </motion.div>
        )}
      </AnimatePresence>

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
          className={cn(
            'text-primary focus-visible:ring-ring mx-auto block rounded text-xs font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          )}
        >
          {method === 'magic-link' ? t('togglePassword') : t('toggleMagicLink')}
        </button>
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
