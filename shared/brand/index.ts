/**
 * Brand asset path registry. Components import these constants instead of
 * hardcoding paths so a future renaming is a one-line change.
 *
 * The SVGs themselves live at `shared/brand/*.svg` and are also copied to
 * `web/public/brand/*` at build time (see `scripts/sync-brand-assets.mjs`,
 * wired into `pnpm dev` and `pnpm build`).
 */

export const BRAND = {
  name: 'BlueCare',
  nameAr: 'بلوكير',
  tagline: {
    en: 'Smart, personalized communication for children with autism.',
    ar: 'تواصل ذكي وشخصي للأطفال ذوي اضطراب طيف التوحد.',
  },
  // Primary URL of the production site. Override at runtime via
  // NEXT_PUBLIC_APP_URL in non-production environments.
  url: 'https://bluecare.app',
  // Designed-in colors used by the brand mark. Mirrored from tokens.palette.
  colors: {
    primary: '#2B6CB0',
    accent: '#A7F3D0',
    ink: '#1E293B',
    canvas: '#F9FAFB',
  },
  // Public asset paths. Resolved against /brand/ at runtime.
  assets: {
    mark: '/brand/logo-mark.svg',
    markMono: '/brand/logo-mark-mono.svg',
    wordmark: { en: '/brand/logo-wordmark-en.svg', ar: '/brand/logo-wordmark-ar.svg' },
    lockup: { en: '/brand/logo-lockup-en.svg', ar: '/brand/logo-lockup-ar.svg' },
    favicon: {
      ico: '/favicon.ico',
      png16: '/favicon-16.png',
      png32: '/favicon-32.png',
      png180: '/apple-touch-icon.png',
      png192: '/icon-192.png',
      png512: '/icon-512.png',
    },
  },
} as const;
