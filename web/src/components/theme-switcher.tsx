'use client';

import { Sun, Moon, Contrast } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

const THEMES = [
  { value: 'light', icon: Sun, key: 'light' as const },
  { value: 'dark', icon: Moon, key: 'dark' as const },
  { value: 'hc', icon: Contrast, key: 'highContrast' as const },
];

export function ThemeSwitcher({ className }: { className?: string }) {
  const t = useTranslations('common.themeSwitcher');
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes: render is gated by mount to avoid SSR/hydration class mismatch
  useEffect(() => setMounted(true), []);

  return (
    <div
      role="group"
      aria-label={t('label')}
      className={cn(
        'border-border bg-bg-elevated inline-flex items-center gap-1 rounded-full border p-1',
        className,
      )}
    >
      {THEMES.map(({ value, icon: Icon, key }) => {
        const selected = mounted && theme === value;
        const label = t(key);
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              'rounded-full p-2 transition-colors',
              'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              selected ? 'bg-primary text-primary-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
