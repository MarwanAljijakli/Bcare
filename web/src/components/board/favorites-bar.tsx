'use client';

import { Star } from 'lucide-react';
import { SymbolTile } from './symbol-tile';
import type { BoardSymbol } from './types';

/**
 * Top-of-board favorites strip — the 8 most-used symbols from the
 * server-side favorites list. Empty until the child has used the board
 * for a few sessions; we hide entirely when empty rather than show "no
 * favorites yet" which adds noise to the calm surface.
 */

interface FavoritesBarProps {
  favoriteIds: string[];
  symbols: BoardSymbol[];
  locale: 'en' | 'ar';
  imageUrl: (path: string) => string;
  size: 'standard' | 'large' | 'extra-large';
  showPhonetic: boolean;
  onSelect: (symbol: BoardSymbol) => void;
  label: string;
}

export function FavoritesBar({
  favoriteIds,
  symbols,
  locale,
  imageUrl,
  size,
  showPhonetic,
  onSelect,
  label,
}: FavoritesBarProps) {
  if (favoriteIds.length === 0) return null;

  const byId = new Map(symbols.map((s) => [s.id, s]));
  const items = favoriteIds.map((id) => byId.get(id)).filter((s): s is BoardSymbol => !!s);
  if (items.length === 0) return null;

  return (
    <section
      aria-label={label}
      className="border-border bg-bg-elevated/80 rounded-2xl border-2 p-3"
      data-testid="favorites-bar"
    >
      <header className="text-fg-muted mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
        <Star aria-hidden="true" className="text-warning h-3.5 w-3.5" />
        {label}
      </header>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {items.map((s) => (
          <SymbolTile
            key={s.id}
            symbol={s}
            locale={locale}
            imageUrl={imageUrl}
            size={size}
            showPhonetic={showPhonetic}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}
