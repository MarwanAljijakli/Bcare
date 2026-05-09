import { waitlistSignupInputSchema } from '@bluecare/shared';
import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * @deprecated Module 1.5 (2026-05-09) made BlueCare free + open. The
 * /pricing page and the waitlist UI are gone — no client code calls this
 * route anymore. The handler is retained so any in-flight requests from
 * cached pages or external integrations don't 404. Schedule for full
 * removal in Module 9 hardening (see docs/backlog.md).
 *
 * Legacy contract preserved below: zod-validate + honeypot + rate limit
 * + Supabase insert with duplicate-via-200 to avoid email enumeration.
 */

// Tiny in-memory rate limiter — IP-keyed, sliding window. Vercel functions
// are stateless across cold starts so this is best-effort per warm instance.
// A persistent rate limit lives in Module 9 hardening (Upstash or pg-based).
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 6;

const ipHits = new Map<string, number[]>();

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (ipHits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  arr.push(now);
  ipHits.set(ip, arr);
  return arr.length > RATE_LIMIT_MAX;
}

function problem(status: number, title: string, detail?: string) {
  return NextResponse.json(
    {
      type: `https://bluecare.app/errors/${status}`,
      title,
      status,
      ...(detail ? { detail } : {}),
      instance: '/api/waitlist',
    },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return problem(429, 'Too many requests', 'Try again in a minute.');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return problem(400, 'Invalid JSON body');
  }

  const parsed = waitlistSignupInputSchema.safeParse(body);
  if (!parsed.success) {
    // Don't echo zod issues to the client — keep the surface small.
    return problem(400, 'Invalid input');
  }

  // Honeypot check belongs at the route boundary, not in the schema. zod
  // already rejects non-empty values, but if some bot omits the field we
  // still pass — which is fine, the response is the same shape.
  if (parsed.data.honeypot && parsed.data.honeypot.length > 0) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  // Insert via the admin client. The waitlist policy permits anonymous
  // INSERT, but we use admin so we can detect duplicate-by-email cleanly
  // and not leak admin-only fields.
  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return problem(500, 'Server not configured');
  }

  const { email, role, locale, source } = parsed.data;

  // Insert payload is typed against the placeholder Supabase Database type;
  // proper generated types arrive in Module 2 (see docs/backlog.md).
  const row = {
    email,
    role,
    locale,
    source: source ?? null,
    metadata: { ip_hash: hashIp(ip) },
  };
  const { error } = await supabase.from('waitlist_signups').insert(row as never);

  if (error) {
    // 23505 = unique_violation (email already on the list). We respond 200
    // so the client can show a friendly "already on the list" state.
    if (error.code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
    }
    return problem(500, 'Could not record signup');
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

// FNV-1a 32-bit hash. We don't need cryptographic strength — this is a
// best-effort dedup signal in the metadata blob, not a security control.
function hashIp(ip: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < ip.length; i++) {
    h ^= ip.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16);
}
