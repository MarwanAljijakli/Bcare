import { NextResponse, type NextRequest } from 'next/server';
import { mockSignup } from '@/lib/auth/dev-mock';
import { AUTH_MODE, logAuthMode } from '@/lib/auth/mode';
import { rateLimitSignup, clientIp } from '@/lib/auth/rate-limit';
import { signupRequestSchema } from '@/lib/auth/zod';

logAuthMode('api/auth/signup');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function problem(status: number, code: string, title: string, detail?: string) {
  return NextResponse.json(
    {
      type: `https://bluecare.app/errors/${code}`,
      title,
      status,
      ...(detail ? { detail } : {}),
      instance: '/api/auth/signup',
    },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

export async function POST(req: NextRequest) {
  if (await rateLimitSignup(clientIp(req))) {
    return problem(429, 'rate_limited', 'Too many signup attempts', 'Try again in a minute.');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return problem(400, 'invalid_json', 'Invalid JSON body');
  }

  const parsed = signupRequestSchema.safeParse(body);
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
    return mockSignup(data);
  }

  // Real Supabase mode. We dynamically import the server client so the
  // Supabase SDK never enters the bundle in mock-only test runs.
  try {
    const { createSupabaseServerClient } = await import('@/lib/supabase/server');
    const supabase = await createSupabaseServerClient();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
    const emailRedirectTo = `${baseUrl}/auth/callback?next=/${data.locale}/onboarding`;

    const userMetadata = {
      full_name: data.fullName,
      role: data.role,
      locale: data.locale,
      ...(data.role === 'school' ? { school_name: data.schoolName } : {}),
      consent: {
        granted: true,
        version: data.consent.version,
        text_hash: data.consent.textHash,
        granted_at: new Date().toISOString(),
      },
    };

    let result;
    if (data.method === 'magic-link') {
      result = await supabase.auth.signInWithOtp({
        email: data.email,
        options: { data: userMetadata, emailRedirectTo, shouldCreateUser: true },
      });
    } else {
      // password method
      if (!data.password) {
        return problem(400, 'invalid_input', 'Password is required');
      }
      result = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: userMetadata, emailRedirectTo },
      });
    }

    if (result.error) {
      const msg = (result.error.message ?? '').toLowerCase();
      if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
        return problem(409, 'user_exists', 'Email already registered');
      }
      if (result.error.status === 429 || msg.includes('rate')) {
        return problem(429, 'rate_limited', 'Too many attempts');
      }
      return problem(500, 'auth_failed', 'Signup failed', result.error.message);
    }

    return NextResponse.json(
      { ok: true, mode: 'real', method: data.method, email: data.email },
      { status: 201 },
    );
  } catch (err) {
    return problem(
      500,
      'auth_failed',
      'Signup failed',
      err instanceof Error ? err.message : 'Unknown error',
    );
  }
}
