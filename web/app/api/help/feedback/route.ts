/**
 * /api/help/feedback — Module 8 anonymous helpful 👍/👎.
 *
 * Public surface (matches /help being public). No auth, no actor_id —
 * writes a row to audit_log keyed only by article_slug + locale +
 * helpful_bool. The service-role insert bypasses RLS since audit_log
 * is normally write-restricted.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  slug: z.string().min(1).max(120),
  locale: z.enum(['en', 'ar']),
  helpful: z.boolean(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  }
  try {
    const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
    const supabase = createSupabaseAdminClient();
    await (
      supabase.from('audit_log') as never as {
        insert: (row: Record<string, unknown>) => Promise<unknown>;
      }
    ).insert({
      actor_id: null,
      action: 'admin_action',
      target_type: 'help_article',
      target_id: parsed.data.slug,
      metadata: {
        kind: 'help_feedback',
        article_slug: parsed.data.slug,
        locale: parsed.data.locale,
        helpful_bool: parsed.data.helpful,
      },
    });
  } catch {
    /* anonymous endpoint — silent failure */
  }
  return NextResponse.json({ ok: true });
}
