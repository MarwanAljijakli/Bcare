/**
 * Brand asset path registry. Components import these constants instead of
 * hardcoding paths so a future renaming is a one-line change.
 *
 * The mark itself lives at `shared/brand/logo-mark.png` and is copied to
 * `web/public/brand/` at build time (see `scripts/sync-brand-assets.mjs`,
 * wired into `pnpm dev` and `pnpm build`). It is the whole brand identity —
 * no separate wordmark or lockup variants.
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
    mark: '/brand/logo-mark.png',
  },
} as const;
