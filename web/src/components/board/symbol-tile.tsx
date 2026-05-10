'use client';

import { forwardRef } from 'react';
import { symbolLabel, symbolPhonetic } from './types';
import type { BoardSymbol } from './types';
import { cn } from '@/lib/cn';

/**
 * One symbol tile. Tablet-first: 88px+ touch target enforced by min-w/h.
 *
 * Keyboard: focusable + selectable via Enter/Space — handled by the host
 * `<button>`. Visible focus ring (4px outline-offset). Selected state
 * uses brand-blue and an inset ring for AAA-grade visibility.
 *
 * `disabled` is reserved for category-filter mismatches; the tile keeps
 * focusability so SR users hear "dimmed: apple" rather than have it
 * disappear on filter.
 */

interface SymbolTileProps {
  symbol: BoardSymbol;
  locale: 'en' | 'ar';
  /** Public CDN URL resolver — server gives us the storage path; the
   *  client resolves to the bucket public URL. */
  imageUrl: (path: string) => string;
  selected?: boolean;
  dimmed?: boolean;
  size?: 'standard' | 'large' | 'extra-large';
  showPhonetic?: boolean;
  onSelect: (symbol: BoardSymbol) => void;
}

const SIZE: Record<NonNullable<SymbolTileProps['size']>, string> = {
  standard: 'min-h-[112px] min-w-[112px]',
  large: 'min-h-[136px] min-w-[136px]',
  'extra-large': 'min-h-[160px] min-w-[160px]',
};

export const SymbolTile = forwardRef<HTMLButtonElement, SymbolTileProps>(function SymbolTile(
  {
    symbol,
    locale,
    imageUrl,
    selected = false,
    dimmed = false,
    size = 'standard',
    showPhonetic = false,
    onSelect,
  },
  ref,
) {
  const label = symbolLabel(symbol, locale);
  const phonetic = showPhonetic ? symbolPhonetic(symbol, locale) : null;

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSelect(symbol)}
      data-testid="symbol-tile"
      data-symbol-id={symbol.id}
      aria-pressed={selected || undefined}
      lang={locale}
      className={cn(
        'border-border bg-bg-elevated group relative flex flex-col items-center justify-end gap-2 rounded-2xl border-2 p-3 transition-[background,border,transform] duration-150',
        'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2',
        SIZE[size],
        selected
          ? 'border-primary bg-primary/10 ring-primary/40 ring-4'
          : 'hover:border-primary/50 hover:bg-bg-muted active:scale-[0.98]',
        dimmed && 'opacity-50',
      )}
    >
      {/* Symbol image. We render a plain <img> rather than next/image so
       *  the offline service-worker cache (Module 3 stretch) can capture
       *  the raw bytes via the cache API rather than next's optimizer. */}
      <span className="relative grid h-full w-full place-items-center">
        {}
        <img
          src={imageUrl(symbol.image_path)}
          alt=""
          className="aspect-square max-h-[80%] w-auto object-contain"
          draggable={false}
          loading="lazy"
        />
      </span>
      <span className="flex flex-col items-center gap-0.5">
        <span
          className={cn(
            'text-fg select-none text-base font-semibold leading-tight',
            // High-contrast theme bumps the weight one step.
            'forced-colors:text-[CanvasText]',
          )}
        >
          {label}
        </span>
        {phonetic && (
          <span className="text-fg-subtle text-xs leading-tight" aria-hidden="true">
            {phonetic}
          </span>
        )}
      </span>
    </button>
  );
});
