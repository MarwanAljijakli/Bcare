'use client';

import { Heart, Stethoscope, GraduationCap, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { forwardRef } from 'react';
import type { SignupRole } from '@/lib/auth/zod';
import { cn } from '@/lib/cn';

interface Role {
  value: SignupRole;
  Icon: LucideIcon;
}

const ROLES: Role[] = [
  { value: 'family', Icon: Heart },
  { value: 'therapist', Icon: Stethoscope },
  { value: 'school', Icon: GraduationCap },
];

interface RoleSelectorProps {
  /** rhf register name; defaults to "role". */
  name?: string;
  value?: SignupRole;
  onChange: (next: SignupRole) => void;
  invalid?: boolean;
  disabled?: boolean;
}

/**
 * Three large radio cards, native semantics.
 *
 * We use real `<input type="radio">` inside `<label>`s, visually hidden via
 * `sr-only`, so the browser's built-in radiogroup gives us:
 *   • arrow keys move between options (built-in roving focus)
 *   • Tab enters / leaves the group
 *   • Space selects the focused option
 *
 * We do NOT use `role="radiogroup"` + custom keyboard handling because the
 * native pattern is more robust across screen readers (NVDA + VoiceOver).
 *
 * Visual selected state is driven by the `peer-checked:` Tailwind variant on
 * the surrounding container.
 */
export const RoleSelector = forwardRef<HTMLFieldSetElement, RoleSelectorProps>(
  function RoleSelector({ name = 'role', value, onChange, invalid, disabled }, ref) {
    const t = useTranslations('marketing.auth.signup');

    return (
      <fieldset
        ref={ref}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${name}-error` : undefined}
        className="grid gap-2"
      >
        <legend className="text-fg mb-1.5 block text-sm font-medium leading-none">
          {t('roleLabel')}
        </legend>
        <p className="text-fg-subtle -mt-1 mb-2 text-xs leading-relaxed">{t('roleHelper')}</p>
        <div className="grid gap-2">
          {ROLES.map(({ value: v, Icon }) => (
            <label
              key={v}
              className={cn(
                'group/role border-border bg-bg-elevated relative flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors',
                'hover:border-primary/50 hover:bg-primary/5',
                'has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:ring-primary/20 has-[:checked]:ring-2',
                'has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2',
                invalid && 'border-danger/60',
                disabled && 'pointer-events-none opacity-60',
              )}
            >
              <input
                type="radio"
                name={name}
                value={v}
                checked={value === v}
                onChange={() => onChange(v)}
                disabled={disabled}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={cn(
                  'grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors',
                  value === v
                    ? 'bg-primary text-primary-fg'
                    : 'bg-bg-muted text-fg-muted group-hover/role:bg-primary/10 group-hover/role:text-primary',
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="flex-1">
                <span className="text-fg block text-sm font-semibold leading-tight">
                  {t(`roles.${v}.label`)}
                </span>
                <span className="text-fg-muted mt-1 block text-xs leading-relaxed">
                  {t(`roles.${v}.description`)}
                </span>
              </span>
              {/* Selected indicator dot — purely decorative; aria-hidden. */}
              <span
                aria-hidden="true"
                className={cn(
                  'border-border mt-1 h-4 w-4 shrink-0 rounded-full border-2 transition-colors',
                  value === v
                    ? 'border-primary bg-primary ring-bg-elevated ring-2 ring-inset'
                    : 'group-hover/role:border-primary/50',
                )}
              />
            </label>
          ))}
        </div>
      </fieldset>
    );
  },
);
