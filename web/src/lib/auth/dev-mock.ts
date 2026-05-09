/**
 * Development-only mock auth backend. Activated when NEXT_PUBLIC_SUPABASE_URL
 * + NEXT_PUBLIC_SUPABASE_ANON_KEY are absent in a development build (see
 * mode.ts). Returns Supabase-compatible response shapes after a small delay
 * so the UI feels real-ish during local development.
 *
 * Trigger conventions (so test specs and developers can drive specific
 * branches):
 *   - email contains "exists"  → 409 user_already_registered
 *   - email contains "rate"    → 429 rate_limited (also kicks the IP limiter
 *                                 once but trips a server-side flag for the
 *                                 single email)
 *   - email contains "boom"    → 500 internal_error
 *   - otherwise                → 201 success after ~800 ms
 */

import { NextResponse } from 'next/server';
import type { LoginRequest, SignupRequest } from './zod';

const MOCK_DELAY_MS = 800;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function problem(status: number, code: string, title: string, detail?: string) {
  return NextResponse.json(
    {
      type: `https://bluecare.app/errors/${code}`,
      title,
      status,
      ...(detail ? { detail } : {}),
      instance: '/api/auth (mock)',
      mode: 'mock',
    },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

export async function mockSignup(input: SignupRequest): Promise<Response> {
  await delay(MOCK_DELAY_MS);

  const email = input.email.toLowerCase();

  if (email.includes('exists')) {
    return problem(409, 'user_exists', 'Email already registered');
  }
  if (email.includes('rate')) {
    return problem(429, 'rate_limited', 'Too many attempts');
  }
  if (email.includes('boom')) {
    return problem(500, 'internal_error', 'Mock failure');
  }

  return NextResponse.json(
    {
      ok: true,
      mode: 'mock',
      method: input.method,
      email: input.email,
      // Echo a fake user object shaped like Supabase's signUp response so the
      // client-side success view doesn't need to branch on mode.
      user: {
        id: `mock-${cryptoRandomId()}`,
        email: input.email,
        email_confirmed_at: null,
        user_metadata: {
          full_name: input.fullName,
          role: input.role,
          school_name: input.schoolName,
          locale: input.locale,
          consent: input.consent,
        },
      },
    },
    { status: 201 },
  );
}

export async function mockLogin(input: LoginRequest): Promise<Response> {
  await delay(MOCK_DELAY_MS);

  const email = input.email.toLowerCase();

  if (email.includes('rate')) {
    return problem(429, 'rate_limited', 'Too many attempts');
  }
  if (email.includes('boom')) {
    return problem(500, 'internal_error', 'Mock failure');
  }
  if (email.includes('notfound')) {
    return problem(404, 'user_not_found', 'No account with that email');
  }
  if (input.method === 'password' && (input.password ?? '') !== 'demo-password-12') {
    // Specific magic password for mock to test the success path; anything
    // else is treated as wrong.
    return problem(401, 'invalid_credentials', 'Invalid email or password');
  }

  return NextResponse.json(
    { ok: true, mode: 'mock', method: input.method, email: input.email },
    { status: 200 },
  );
}

function cryptoRandomId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // Cheap fallback — only ever runs in dev mock.
  return Math.random().toString(36).slice(2, 10);
}
