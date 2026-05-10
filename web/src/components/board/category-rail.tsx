'use client';

import { Apple, Heart, Layers, MapPin, Sparkles, Timer, Users, Zap } from 'lucide-react';
import type { CategoryKey } from './types';
import { cn } from '@/lib/cn';

/**
 * Leading-edge category rail. Vertical column of icon+label buttons that
 * filter the grid. RTL-safe: uses `start`/`end` Tailwind classes so the
 * rail flips to the right edge in AR layout via the html `dir` attribute.
 */

const CATEGORY_ICONS: Record<CategoryKey, React.ComponentType<{ className?: string }>> = {
  all: Layers,
  core: Sparkles,
  food: Apple,
  feelings: Heart,
  people: Users,
  actions: Zap,
  places: MapPin,
  time: Timer,
};

interface CategoryRailProps {
  active: CategoryKey;
  onChange: (cat: CategoryKey) => void;
  /** Localized labels keyed by category. */
  labels: Record<CategoryKey, string>;
}

const ORDER: CategoryKey[] = [
  'all',
  'core',
  'food',
  'feelings',
  'people',
  'actions',
  'places',
  'time',
];

export function CategoryRail({ active, onChange, labels }: CategoryRailProps) {
  return (
    <nav
      aria-label="categories"
      className="border-border bg-bg-elevated flex shrink-0 flex-col gap-1 rounded-2xl border-2 p-2"
    >
      {ORDER.map((key) => {
        const Icon = CATEGORY_ICONS[key];
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={isActive}
            data-testid={`category-${key}`}
            className={cn(
              'focus-visible:ring-ring inline-flex w-full min-w-[112px] items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2',
              isActive
                ? 'bg-primary/10 text-primary border-primary/30 border-2'
                : 'text-fg-muted hover:bg-bg-muted hover:text-fg border-2 border-transparent',
            )}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="truncate">{labels[key]}</span>
          </button>
        );
      })}
    </nav>
  );
}
