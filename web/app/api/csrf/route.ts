import { NextResponse } from 'next/server';
import { ensureCsrfCookie } from '@/lib/auth/csrf';

/**
 * Mints (or refreshes) the CSRF cookie. Authenticated client surfaces
 * call this once on mount so they have a token to echo into the
 * `x-csrf-token` header on every mutating tRPC call.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const token = await ensureCsrfCookie();
  return NextResponse.json({ token });
}
