'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react';
import { scorePassword, type StrengthLabel } from '@/lib/auth/strength';
import { cn } from '@/lib/cn';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Current password value (controlled). */
  value: string;
  /** When true, render the strength meter under the input. */
  showStrength?: boolean;
  /** Inline error message (rendered under the meter). */
  error?: string | null;
  /** Override the show/hide button label namespace (signup vs login). */
  i18nNamespace?: 'marketing.auth.signup' | 'marketing.auth.login';
}

const STRENGTH_TONE: Record<StrengthLabel, { fill: string; tone: string }> = {
  weak: { fill: 'bg-danger', tone: 'text-danger' },
  okay: { fill: 'bg-warning', tone: 'text-warning' },
  strong: { fill: 'bg-success', tone: 'text-success' },
  excellent: { fill: 'bg-primary', tone: 'text-primary' },
};

/**
 * Password input with show/hide toggle and an optional strength meter.
 *
 * The meter is announced to screen readers via aria-live="polite" and
 * mirrored as text — sighted users see colored bars, AT users hear the
 * label. Color alone never carries meaning.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    {
      value,
      showStrength = false,
      error,
      i18nNamespace = 'marketing.auth.signup',
      className,
      id,
      ...rest
    },
    ref,
  ) {
    const t = useTranslations(i18nNamespace);
    const [visible, setVisible] = useState(false);
    const reactId = useId();
    const inputId = id ?? `pw-${reactId}`;
    const meterId = `${inputId}-meter`;
    const errorId = `${inputId}-error`;

    const strength = showStrength ? scorePassword(value) : null;
    const tone = strength ? STRENGTH_TONE[strength.label] : null;

    return (
      <div>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            value={value}
            aria-invalid={!!error || undefined}
            aria-describedby={
              cn(showStrength ? meterId : undefined, error ? errorId : undefined) || undefined
            }
            className={cn(
              'border-border bg-bg-elevated text-fg placeholder:text-fg-subtle',
              'flex h-11 w-full rounded-xl border px-4 py-2 pe-12 text-base shadow-sm',
              'transition-colors',
              'focus-visible:ring-ring focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-danger/60 focus-visible:border-danger',
              className,
            )}
            {...rest}
          />
          <button
            type="button"
            aria-label={visible ? t('hidePassword') : t('showPassword')}
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
            tabIndex={0}
            className={cn(
              'text-fg-muted hover:text-fg focus-visible:ring-ring absolute inset-y-0 end-2 my-auto inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            )}
          >
            {visible ? (
              <EyeOff aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Eye aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        </div>

        {showStrength && (
          <div id={meterId} className="mt-2" aria-live="polite">
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className={cn(
                    'bg-border-strong/40 h-1.5 flex-1 rounded-full transition-colors',
                    strength && i < strength.score && tone?.fill,
                  )}
                />
              ))}
              {strength && strength.score > 0 && (
                <span className={cn('ms-2 text-xs font-medium', tone?.tone)}>
                  {t(`strength.${strength.label}`)}
                </span>
              )}
            </div>
          </div>
        )}

        {error && (
          <p id={errorId} role="alert" className="text-danger mt-1.5 text-xs leading-relaxed">
            {error}
          </p>
        )}
      </div>
    );
  },
);
