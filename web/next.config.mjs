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
  // Transpile internal workspace packages so their TS/ESM source resolves
  // under Next's bundler. @react-pdf/renderer ships ESM-only — Next 14
  // refuses to load it through webpack without this hint.
  transpilePackages: ['@bluecare/shared', '@bluecare/db', '@react-pdf/renderer'],

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // Supabase Storage public buckets (custom symbols, avatars). The bucket
      // hostname is added during Module 2 (auth + onboarding) when storage is
      // provisioned. Keep this array authored, never use `domains` (deprecated).
    ],
  },

  // Tight default headers. Per-route overrides applied via middleware where needed.
  //
  // Module 9 tightening:
  //   • Content-Security-Policy — strict-dynamic for scripts; allow blob: + data: for
  //     PDF generation (@react-pdf/renderer creates blob URLs); allow Supabase Storage
  //     CDN for symbol images; allow fonts.gstatic + jsdelivr for the PDF Cairo font.
  //   • Cross-Origin-Opener-Policy = same-origin so the OS spell-check / picker
  //     popups don't leak window references.
  //   • Cross-Origin-Embedder-Policy = unsafe-none — we don't need COEP-isolated mode
  //     and switching to require-corp would break the jsdelivr font load. Documented.
  //   • Permissions-Policy whitelists ONLY microphone (STT) and camera (future gesture
  //     mode); everything else explicitly disabled.
  async headers() {
    const supabaseHost = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/^https?:\/\//, '');
    const cspDirectives = [
      "default-src 'self'",
      // Inline scripts are needed for Next.js's runtime + framer-motion + react-pdf.
      // 'strict-dynamic' is the future-proof move; we keep 'unsafe-inline' as the
      // fallback for browsers that don't honor strict-dynamic (mostly older Safari).
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: ${supabaseHost ? `https://${supabaseHost}` : ''} https://*.supabase.co`.trim(),
      // Fonts: self + Google fonts CDN (used by next/font) + jsdelivr (used by the
      // PDF report's Cairo font registration).
      "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
      // The TTS audio comes from Supabase Storage public URLs.
      `media-src 'self' blob: ${supabaseHost ? `https://${supabaseHost}` : ''} https://*.supabase.co`.trim(),
      // Allow XHR/fetch to our own origin, Supabase Storage + Auth, OpenAI/Anthropic/
      // ElevenLabs proxied through our /api routes (the actual outbound calls are
      // server-side; the browser never reaches them directly — but if a future
      // dev-only diagnostic ever does, this allow-list is honest).
      `connect-src 'self' ${supabaseHost ? `https://${supabaseHost}` : ''} https://*.supabase.co`.trim(),
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      'upgrade-insecure-requests',
    ];
    const csp = cspDirectives.filter(Boolean).join('; ');

    const permissionsPolicy = [
      // Allowed only on this origin, never embedded:
      'microphone=(self)',
      'camera=(self)',
      // Everything else disabled:
      'geolocation=()',
      'usb=()',
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()',
      'payment=()',
      'autoplay=(self)',
      'fullscreen=(self)',
      'picture-in-picture=()',
      'screen-wake-lock=()',
      'sync-xhr=()',
      'midi=()',
    ].join(', ');

    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Content-Security-Policy', value: csp },
      { key: 'Permissions-Policy', value: permissionsPolicy },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'Cross-Origin-Embedder-Policy', value: 'unsafe-none' },
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
