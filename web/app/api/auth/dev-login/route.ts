/**
 * /api/auth/dev-login — Module 2.A.1.bypass entry point.
 *
 * Refuses to run unless AUTH_BYPASS_USER_ID is set. When active, mints a
 * real Supabase session for the pre-seeded dev caregiver and sets the
 * cookie-bound auth state so every subsequent request hits real RLS as
 * that user. No email roundtrip.
 *
 * Mechanism (server-side, using the cookie-bound supabase client):
 *   1. supabase.auth.admin.generateLink({ type: 'magiclink', email })
 *      returns a token + hashed_token without actually sending an email.
 *   2. supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }) on the
 *      cookie-bound client consumes the token and writes the auth
 *      cookies (sb-<ref>-auth-token-*) to the response. Same end-state
 *      Supabase achieves when a real magic link is clicked.
 *   3. Response is a 303 redirect to `next` (default /[locale]/dashboard).
 *
 * Both GET and POST work:
 *   • GET  — used by the (auth) login + signup pages and the (app)
 *             auth-gate redirect; reads ?next= from the query string.
 *   • POST — used by the form-submit fallback path so the existing
 *             /api/auth/signup + /api/auth/login routes can return
 *             { ok: true, redirectTo: ... } and let the client navigate.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { DEV_CAREGIVER_EMAIL, isAuthBypassActive } from '@/lib/auth/bypass';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function notActive() {
  return NextResponse.json({ ok: false, reason: 'bypass_not_active' }, { status: 404 });
}

async function mintSession(): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const { createSupabaseServerClient, createSupabaseAdminClient } =
      await import('@/lib/supabase/server');
    const admin = createSupabaseAdminClient();
    const cookieClient = await createSupabaseServerClient();

    const link = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: DEV_CAREGIVER_EMAIL,
    });
    if (link.error) {
      return { ok: false, reason: `generate_link: ${link.error.message}` };
    }
    const tokenHash = link.data.properties?.hashed_token;
    if (!tokenHash) {
      return { ok: false, reason: 'no_hashed_token' };
    }

    const verify = await cookieClient.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    });
    if (verify.error) {
      return { ok: false, reason: `verify_otp: ${verify.error.message}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'unknown_error' };
  }
}

function safeNextPath(input: string | null): string {
  if (!input || !input.startsWith('/') || input.startsWith('//')) return '/en/dashboard';
  return input;
}

export async function GET(req: NextRequest) {
  if (!isAuthBypassActive()) return notActive();
  const url = new URL(req.url);
  const next = safeNextPath(url.searchParams.get('next'));

  const minted = await mintSession();
  if (!minted.ok) {
    return NextResponse.json({ ok: false, reason: minted.reason }, { status: 500 });
  }
  return NextResponse.redirect(new URL(next, url.origin), { status: 303 });
}

export async function POST(req: NextRequest) {
  if (!isAuthBypassActive()) return notActive();
  const url = new URL(req.url);
  let next = '/en/dashboard';
  try {
    const body = (await req.json()) as { next?: string } | null;
    if (body?.next) next = safeNextPath(body.next);
  } catch {
    /* body optional */
  }

  const minted = await mintSession();
  if (!minted.ok) {
    return NextResponse.json({ ok: false, reason: minted.reason }, { status: 500 });
  }
  return NextResponse.json({ ok: true, mode: 'bypass', redirectTo: next, baseUrl: url.origin });
}
