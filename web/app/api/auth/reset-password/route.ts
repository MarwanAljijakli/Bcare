/**
 * /api/auth/reset-password — Module 9.9.
 *
 * POST { email } → triggers Supabase auth.resetPasswordForEmail, which
 * mails the user a recovery link that lands on /[locale]/reset-password/
 * confirm. The user's locale preference travels via the redirectTo URL
 * so the confirm page renders in the correct language.
 *
 * Always returns 200 — we don't tell the client whether the email
 * exists (anti-enumeration). The rate limiter prevents brute-forcing
 * the existence oracle anyway, but constant-status response is the
 * cleaner posture.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { clientIp, rateLimitLogin } from '@/lib/auth/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().email().max(254),
  locale: z.enum(['en', 'ar']).default('en'),
});

export async function POST(req: NextRequest) {
  if (await rateLimitLogin(clientIp(req))) {
    return NextResponse.json({ ok: true }, { status: 200 }); // silent
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }
  const supabase = createSupabaseAdminClient();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bcare-ten.vercel.app';
  try {
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${baseUrl}/${parsed.data.locale}/reset-password/confirm`,
    });
  } catch {
    /* swallow — anti-enumeration */
  }
  return NextResponse.json({ ok: true });
}
