'use client';

import { useMemo } from 'react';
import { SymbolTile } from './symbol-tile';
import type { BoardSymbol, CategoryKey } from './types';

/**
 * Grid layout for symbols. Filters by active category and renders tiles
 * in a responsive grid that hits 88px+ minimum touch target on phones
 * and grows comfortably on tablets / desktops.
 *
 * Sort order: caregiver-curated `vocabulary_sets.position` would beat
 * everything once Module 4 personalization populates it. For now we sort
 * by the server-side `global_frequency` already returned in the bootstrap.
 */

interface SymbolGridProps {
  symbols: BoardSymbol[];
  locale: 'en' | 'ar';
  imageUrl: (path: string) => string;
  category: CategoryKey;
  size: 'standard' | 'large' | 'extra-large';
  showPhonetic: boolean;
  selectedSymbolId?: string | null;
  onSelect: (symbol: BoardSymbol) => void;
}

export function SymbolGrid({
  symbols,
  locale,
  imageUrl,
  category,
  size,
  showPhonetic,
  selectedSymbolId,
  onSelect,
}: SymbolGridProps) {
  const filtered = useMemo(() => {
    if (category === 'all') return symbols;
    return symbols.filter((s) => s.categories.includes(category));
  }, [symbols, category]);

  if (filtered.length === 0) {
    return (
      <div className="text-fg-muted border-border col-span-full flex items-center justify-center rounded-2xl border border-dashed p-12 text-sm">
        {/* Locale-correct empty-state copy is handled by the parent — we
         *  keep this render dependency-free so Storybook can mount the
         *  component without next-intl. */}
        <span lang={locale}>—</span>
      </div>
    );
  }

  return (
    <div
      role="grid"
      aria-label="symbol grid"
      className="grid w-full auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
    >
      {filtered.map((s) => (
        <div role="gridcell" key={s.id}>
          <SymbolTile
            symbol={s}
            locale={locale}
            imageUrl={imageUrl}
            selected={selectedSymbolId === s.id}
            size={size}
            showPhonetic={showPhonetic}
            onSelect={onSelect}
          />
        </div>
      ))}
    </div>
  );
}
