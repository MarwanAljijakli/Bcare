'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ReactNode } from 'react';

/**
 * Three theme modes: `light`, `dark`, `hc` (high-contrast). The HC mode is a
 * first-class citizen, not a CSS-only afterthought — it has its own token set
 * with AAA contrast on every text-on-background pair. See `shared/tokens.ts`.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="light"
      themes={['light', 'dark', 'hc']}
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
