import { NextResponse, type NextRequest } from 'next/server';
import { mockLogin } from '@/lib/auth/dev-mock';
import { AUTH_MODE, logAuthMode } from '@/lib/auth/mode';
import { rateLimitLogin, clientIp } from '@/lib/auth/rate-limit';
import { loginRequestSchema } from '@/lib/auth/zod';

logAuthMode('api/auth/login');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function problem(status: number, code: string, title: string, detail?: string) {
  return NextResponse.json(
    {
      type: `https://bluecare.app/errors/${code}`,
      title,
      status,
      ...(detail ? { detail } : {}),
      instance: '/api/auth/login',
    },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

export async function POST(req: NextRequest) {
  if (rateLimitLogin(clientIp(req))) {
    return problem(429, 'rate_limited', 'Too many login attempts', 'Try again in a minute.');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return problem(400, 'invalid_json', 'Invalid JSON body');
  }

  const parsed = loginRequestSchema.safeParse(body);
  if (!parsed.success) {
    return problem(400, 'invalid_input', 'Invalid input');
  }
  const data = parsed.data;

  if (AUTH_MODE === 'unconfigured') {
    return problem(
      503,
      'unconfigured',
      'Auth temporarily unavailable',
      'Supabase credentials are not yet configured for this environment.',
    );
  }

  if (AUTH_MODE === 'mock') {
    return mockLogin(data);
  }

  try {
    const { createSupabaseServerClient } = await import('@/lib/supabase/server');
    const supabase = await createSupabaseServerClient();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
    const emailRedirectTo = `${baseUrl}/auth/callback?next=/${data.locale}`;

    if (data.method === 'magic-link') {
      const { error } = await supabase.auth.signInWithOtp({
        email: data.email,
        // Don't auto-create users on login; if they're not in the system we
        // want a kind "no account found" message, not a silent signup.
        options: { emailRedirectTo, shouldCreateUser: false },
      });
      if (error) {
        const msg = (error.message ?? '').toLowerCase();
        if (msg.includes('not found') || msg.includes('user not found')) {
          return problem(404, 'user_not_found', 'No account with that email');
        }
        if (error.status === 429 || msg.includes('rate')) {
          return problem(429, 'rate_limited', 'Too many attempts');
        }
        return problem(500, 'auth_failed', 'Login failed', error.message);
      }
      return NextResponse.json(
        { ok: true, mode: 'real', method: 'magic-link', email: data.email },
        { status: 200 },
      );
    }

    // password method
    if (!data.password) {
      return problem(400, 'invalid_input', 'Password is required');
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) {
      const msg = (error.message ?? '').toLowerCase();
      if (msg.includes('invalid') || msg.includes('credentials')) {
        return problem(401, 'invalid_credentials', 'Invalid email or password');
      }
      if (error.status === 429 || msg.includes('rate')) {
        return problem(429, 'rate_limited', 'Too many attempts');
      }
      return problem(500, 'auth_failed', 'Login failed', error.message);
    }

    return NextResponse.json(
      { ok: true, mode: 'real', method: 'password', email: data.email },
      { status: 200 },
    );
  } catch (err) {
    return problem(
      500,
      'auth_failed',
      'Login failed',
      err instanceof Error ? err.message : 'Unknown error',
    );
  }
}
