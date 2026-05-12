import { setRequestLocale } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

/**
 * /admin/symbols-audit — Quality Fix Phase 4 monitoring surface.
 *
 * Read-only view onto the latest `symbol_audit` run. After Phase 1's
 * verified-by-construction reseed every symbol on the board has an
 * audit row with matches=true; this page exists so an operator can
 * spot regressions if they slip in (caregiver-uploaded customs that
 * fail audit, ARASAAC source updates that change pictogram content,
 * etc.).
 *
 * Auth gate: parent (app)/layout.tsx ensures sign-in. Admin role
 * check via `profiles.role='admin'` is the next layer up — for now
 * the (app)/layout requires sign-in; full admin role gating ships
 * with the next admin-tools module.
 */

interface AuditRow {
  id: string;
  audit_run_id: string;
  symbol_id: string;
  matches: boolean;
  confidence: number;
  claude_description: string;
  recommended_label_en: string | null;
  recommended_label_ar: string | null;
  audited_at: string;
  model: string;
}

interface SymbolRow {
  id: string;
  label_en: string;
  label_ar: string;
  image_path: string;
  status: string;
  category: string | null;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: 'admin/symbols-audit',
    title: 'Symbol quality review',
    description: 'Read-only view onto the latest Claude vision review of the symbol library.',
    robots: { index: false, follow: false },
  });
}

async function loadAudit() {
  try {
    const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
    const sb = createSupabaseAdminClient();
    const auditRes = await (
      sb.from('symbol_audit') as never as {
        select: (cols: string) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => Promise<{
            data: AuditRow[] | null;
          }>;
        };
      }
    )
      .select('*')
      .order('audited_at', { ascending: false });
    const rows = auditRes.data ?? [];
    if (rows.length === 0)
      return { runId: null, runRows: [] as AuditRow[], symbols: new Map<string, SymbolRow>() };

    const byRun = new Map<string, AuditRow[]>();
    for (const r of rows) {
      const list = byRun.get(r.audit_run_id) ?? [];
      list.push(r);
      byRun.set(r.audit_run_id, list);
    }
    const sorted = Array.from(byRun.entries()).sort((a, b) => b[1].length - a[1].length);
    const [runId, runRows] = sorted[0]!;
    const symRes = await (
      sb.from('symbols') as never as {
        select: (cols: string) => {
          in: (col: string, v: string[]) => Promise<{ data: SymbolRow[] | null }>;
        };
      }
    )
      .select('id, label_en, label_ar, image_path, status, category')
      .in(
        'id',
        runRows.map((r) => r.symbol_id),
      );
    const symbols = new Map<string, SymbolRow>();
    for (const s of symRes.data ?? []) symbols.set(s.id, s);
    return { runId, runRows, symbols };
  } catch {
    return { runId: null, runRows: [] as AuditRow[], symbols: new Map<string, SymbolRow>() };
  }
}

export default async function SymbolsAuditPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { runId, runRows, symbols } = await loadAudit();
  const matched = runRows.filter((r) => r.matches);
  const mismatched = runRows.filter((r) => !r.matches);

  return (
    <main className="container space-y-6 py-10">
      <header>
        <h1 className="text-fg text-3xl font-bold">Symbol quality review</h1>
        <p className="text-fg-muted mt-2 text-sm">
          Latest Claude vision review of the symbol library — read-only.
        </p>
      </header>

      {!runId ? (
        <div className="border-border bg-bg-elevated rounded-2xl border p-6">
          <p className="text-fg-muted text-sm">
            No audit runs recorded yet. Run{' '}
            <code className="bg-bg-muted rounded px-1.5 py-0.5">
              pnpm exec tsx db/scripts/audit-symbols.ts
            </code>{' '}
            to populate this view.
          </p>
        </div>
      ) : (
        <>
          <section className="border-border bg-bg-elevated rounded-2xl border p-6">
            <p className="text-fg-subtle text-xs font-semibold uppercase tracking-wide">
              Latest run
            </p>
            <p className="text-fg mt-1 font-mono text-xs">{runId}</p>
            <dl className="mt-4 grid grid-cols-3 gap-3">
              <Stat label="Total symbols" value={runRows.length} />
              <Stat label="Matched" value={matched.length} tone="ok" />
              <Stat
                label="Mismatched"
                value={mismatched.length}
                tone={mismatched.length > 0 ? 'alert' : 'ok'}
              />
            </dl>
          </section>

          {mismatched.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-fg text-lg font-bold">Needs review</h2>
              <ul className="space-y-2">
                {mismatched.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30"
                  >
                    <AuditCard row={r} symbol={symbols.get(r.symbol_id)} locale={locale} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-2">
            <h2 className="text-fg text-lg font-bold">Matches ({matched.length})</h2>
            <details className="border-border bg-bg-elevated rounded-2xl border p-4">
              <summary className="text-fg-muted cursor-pointer text-sm">
                Click to expand the full match list
              </summary>
              <ul className="mt-3 space-y-1.5">
                {matched.map((r) => (
                  <li key={r.id} className="text-fg-muted text-xs">
                    <span className="text-fg font-semibold">
                      {symbols.get(r.symbol_id)?.label_en ?? r.symbol_id}
                    </span>{' '}
                    / {symbols.get(r.symbol_id)?.label_ar ?? '—'}{' '}
                    <span className="text-fg-subtle tabular-nums">
                      conf {r.confidence.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        </>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'ok' | 'alert';
}) {
  const cls =
    tone === 'alert'
      ? 'text-amber-700 dark:text-amber-300'
      : tone === 'ok'
        ? 'text-emerald-700 dark:text-emerald-400'
        : 'text-fg';
  return (
    <div>
      <dt className="text-fg-subtle text-[10px] font-semibold uppercase tracking-wide">{label}</dt>
      <dd className={`mt-1 text-2xl font-bold tabular-nums ${cls}`}>{value}</dd>
    </div>
  );
}

function AuditCard({
  row,
  symbol,
  locale,
}: {
  row: AuditRow;
  symbol: SymbolRow | undefined;
  locale: AppLocale;
}) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const imgUrl = symbol
    ? `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/symbols-public/${symbol.image_path}`
    : null;
  return (
    <div className="flex gap-4">
      {imgUrl && (
        <img
          alt=""
          src={imgUrl}
          className="border-border h-20 w-20 shrink-0 rounded-lg border bg-white object-contain"
        />
      )}
      <div className="min-w-0 flex-1 space-y-1 text-sm">
        <p className="text-fg font-bold">
          {symbol?.label_en ?? '?'} / {symbol?.label_ar ?? '?'}
          <span className="text-fg-muted ms-2 text-xs tabular-nums">
            conf {row.confidence.toFixed(2)}
          </span>
        </p>
        <p className="text-fg-muted text-xs">
          <strong>
            {locale === 'ar' ? 'ما تظهره الصورة فعلًا:' : 'What image actually shows:'}
          </strong>{' '}
          {row.claude_description}
        </p>
        <p className="text-fg-muted text-xs">
          <strong>{locale === 'ar' ? 'الوسوم المقترحة:' : 'Recommended:'}</strong>{' '}
          {row.recommended_label_en ?? '—'} / {row.recommended_label_ar ?? '—'}
        </p>
        <p className="text-fg-subtle font-mono text-[10px]">
          {row.symbol_id} · {row.model}
        </p>
      </div>
    </div>
  );
}
