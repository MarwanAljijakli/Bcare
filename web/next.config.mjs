import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// =============================================================================
// Module 2.A.1.bypass — production build guard.
//
// REFUSE to build a Vercel `production` bundle when AUTH_BYPASS_USER_ID is
// set unless ALLOW_AUTH_BYPASS_IN_PRODUCTION=true is also set. The escape
// hatch exists because we DO intentionally ship bypass to the production
// Vercel environment during Modules 6-9 buildout — but the second flag
// forces an explicit, auditable opt-in so a future "let me just remove
// the bypass env var" misstep can't accidentally leave bypass active in
// the launch build.
//
// Pre-launch checklist (docs/runbook.md): remove AUTH_BYPASS_USER_ID,
// NEXT_PUBLIC_AUTH_BYPASS, and ALLOW_AUTH_BYPASS_IN_PRODUCTION from every
// Vercel scope. Force-redeploy. /api/health/auth must report
// bypassActive:false.
// =============================================================================
if (
  process.env.VERCEL_ENV === 'production' &&
  process.env.AUTH_BYPASS_USER_ID &&
  process.env.AUTH_BYPASS_USER_ID.trim().length > 0 &&
  process.env.ALLOW_AUTH_BYPASS_IN_PRODUCTION !== 'true'
) {
  throw new Error(
    [
      '',
      '🚫  Refusing to build: AUTH_BYPASS_USER_ID is set in a Vercel `production` build,',
      '    but ALLOW_AUTH_BYPASS_IN_PRODUCTION is not "true".',
      '',
      '    Choose one:',
      '      A. Remove AUTH_BYPASS_USER_ID + NEXT_PUBLIC_AUTH_BYPASS from production env',
      '         (recommended pre-launch).',
      '      B. Set ALLOW_AUTH_BYPASS_IN_PRODUCTION=true (intentional dev-on-prod).',
      '',
      '    See docs/runbook.md § "Pre-launch auth re-enablement checklist".',
      '',
    ].join('\n'),
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  experimental: {
    typedRoutes: true,
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-tooltip',
    ],
  },
  // Hard cap on route handler body sizes — TTS audio + custom voices flow through
  // Supabase Storage signed uploads, not the API.
  serverRuntimeConfig: {
    maxBodySizeMb: 1,
  },
  // Transpile internal workspace packages so their TS/ESM source resolves under Next's bundler.
  transpilePackages: ['@bluecare/shared', '@bluecare/db'],

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // Supabase Storage public buckets (custom symbols, avatars). The bucket
      // hostname is added during Module 2 (auth + onboarding) when storage is
      // provisioned. Keep this array authored, never use `domains` (deprecated).
    ],
  },

  // Tight default headers. Per-route overrides applied via middleware where needed.
  async headers() {
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
    ];
    return [{ source: '/:path*', headers: securityHeaders }];
  },

  // Permanent (308) redirects from removed routes.
  // /pricing is gone — BlueCare is free. Inbound links from search engines,
  // press, and stakeholders should land on /signup.
  async redirects() {
    return [
      { source: '/:locale(en|ar)/pricing', destination: '/:locale/signup', permanent: true },
      // Bare /pricing (no locale prefix) gets caught by the next-intl middleware
      // first and rewritten to /:locale/pricing, which then matches the rule
      // above. We add an explicit rule too so direct hits work even if the
      // middleware matcher changes.
      { source: '/pricing', destination: '/en/signup', permanent: true },
    ];
  },
};

export default withNextIntl(nextConfig);
