/**
 * Lightweight liveness probe for the auth + Supabase data path.
 *
 * Why this exists: Module 2.A.1.fix taught us that a route handler can
 * still respond 200 to /api/health while production signup is broken
 * because of a trigger ordering bug or a project-ref drift. This
 * endpoint exercises the actual Supabase service-role path so a cheap
 * external probe can spot misroute or DB drift before users do.
 *
 * Module 2.A.1.fix.2 added the magic-link URL assertion below: the
 * next-intl middleware was rewriting /auth/callback → /en/auth/callback,
 * which 404s. The /api/health/auth probe didn't catch it because we
 * never followed the magic link. We now generate a real magic-link via
 * the admin API and assert the embedded redirect URL has neither
 * /en/auth/callback nor /ar/auth/callback in it. If a future config
 * change re-introduces the bug, this probe catches it.
 *
 * Behavior:
 *   • Calls supabase.auth.admin.listUsers({page:1, perPage:1}) — minimal
 *     read, no writes, no rate-limit risk.
 *   • Calls supabase.auth.admin.generateLink({type:'magiclink', email:
 *     'health-check@bluecare.app'}) — generates a fresh link for a
 *     reserved health-check email + asserts the URL shape. The user
 *     row is auto-created on first call but no email is ever sent
 *     (generateLink returns the URL inline; sendmail never fires).
 *   • Returns:
 *     - 200 {ok:true, supabaseProject, magicLinkOk:true, ...} on success.
 *     - 503 {ok:false, reason, ...} on misroute, DB drift, or callback
 *       URL regression.
 *
 * The personalization cron pings this and audit-logs a
 * `config_drift_detected` row when it returns ok:false.
 */

import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEALTH_CHECK_EMAIL = 'health-check@bluecare.app';

function projectRefFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
  return m ? m[1]! : null;
}

interface CallbackUrlAssertion {
  ok: boolean;
  reason?: 'locale_prefix_present' | 'no_action_link' | 'generate_failed' | 'wrong_callback_path';
  actionLink?: string;
}

/**
 * Assert that a freshly-generated magic-link's action URL points at
 * /auth/callback (no locale prefix). Catches regressions of Module
 * 2.A.1.fix.2 in production before a real user clicks a broken link.
 */
async function assertMagicLinkUrl(): Promise<CallbackUrlAssertion> {
  try {
    const supabase = createSupabaseAdminClient();
    // generateLink with type='magiclink' returns the action_link inline
    // and DOES NOT send the email — perfect for a health probe.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bcare-ten.vercel.app';
    const expectedRedirect = `${baseUrl}/auth/callback?next=%2Fen%2Fonboarding`;
    const res = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: HEALTH_CHECK_EMAIL,
      options: { redirectTo: `${baseUrl}/auth/callback?next=/en/onboarding` },
    });
    if (res.error) return { ok: false, reason: 'generate_failed' };
    const actionLink = res.data.properties?.action_link;
    if (!actionLink) return { ok: false, reason: 'no_action_link' };

    // Supabase's generateLink returns a URL like:
    //   https://<ref>.supabase.co/auth/v1/verify?token=...&type=magiclink
    //     &redirect_to=https%3A%2F%2Fbcare-ten.vercel.app%2Fauth%2Fcallback...
    // Decode the redirect_to query param so the substring checks below
    // operate on the literal /auth/callback path rather than its
    // percent-encoded form.
    const decodedTarget = (() => {
      try {
        const u = new URL(actionLink);
        return u.searchParams.get('redirect_to') ?? decodeURIComponent(actionLink);
      } catch {
        return decodeURIComponent(actionLink);
      }
    })();

    // The exact failure mode we're guarding against: middleware rewrites
    // /auth/callback → /en/auth/callback or /ar/auth/callback in the
    // redirect URL embedded in the action_link query string.
    if (/\/(?:en|ar)\/auth\/callback/.test(decodedTarget)) {
      return { ok: false, reason: 'locale_prefix_present', actionLink };
    }
    if (!decodedTarget.includes('/auth/callback')) {
      return { ok: false, reason: 'wrong_callback_path', actionLink };
    }
    return { ok: true, actionLink: expectedRedirect };
  } catch {
    return { ok: false, reason: 'generate_failed' };
  }
}

export async function GET() {
  const expectedRef = projectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!expectedRef) {
    return NextResponse.json({ ok: false, reason: 'no_supabase_url' }, { status: 503 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const res = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (res.error) {
      return NextResponse.json(
        {
          ok: false,
          reason: 'supabase_call_failed',
          message: res.error.message,
          supabaseProject: expectedRef,
        },
        { status: 503 },
      );
    }

    const magicLink = await assertMagicLinkUrl();
    if (!magicLink.ok) {
      return NextResponse.json(
        {
          ok: false,
          reason: 'magic_link_url_check_failed',
          magicLinkReason: magicLink.reason,
          supabaseProject: expectedRef,
          // Deliberately do NOT echo the actual action_link in failure mode
          // either — it grants account access for the health-check inbox.
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      supabaseProject: expectedRef,
      magicLinkOk: true,
      // Phase 10.C — bypass is permanently OFF in production. Field
      // retained for backwards compatibility with the existing cron
      // drift detector + e2e specs.
      bypassActive: false,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        reason: 'unexpected_error',
        message: e instanceof Error ? e.message : 'unknown',
        supabaseProject: expectedRef,
      },
      { status: 503 },
    );
  }
}
