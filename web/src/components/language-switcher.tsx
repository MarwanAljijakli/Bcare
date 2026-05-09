'use client';

import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { usePathname, useRouter, type AppLocale } from '@/i18n/routing';
import { cn } from '@/lib/cn';

/**
 * Switches locale while preserving the current pathname. Renders as an
 * accessible toggle pair so a single tap suffices on the child surface header.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations('common.languageSwitcher');
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (next: AppLocale) => {
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  };

  return (
    <div
      role="group"
      aria-label={t('label')}
      className={cn(
        'border-border bg-bg-elevated inline-flex items-center gap-1 rounded-full border p-1',
        className,
      )}
    >
      <Languages aria-hidden="true" className="text-fg-subtle ms-2 h-4 w-4 shrink-0" />
      {(['en', 'ar'] as const).map((code) => {
        const selected = code === locale;
        const label = code === 'ar' ? t('arabic') : t('english');
        return (
          <button
            key={code}
            type="button"
            disabled={pending && !selected}
            aria-pressed={selected}
            aria-label={t('switchTo', { language: label })}
            onClick={() => choose(code)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              selected ? 'bg-primary text-primary-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            <span lang={code}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
