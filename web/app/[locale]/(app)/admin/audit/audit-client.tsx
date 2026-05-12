'use client';

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';

const AUDIT_ACTIONS = [
  'sign_in',
  'sign_out',
  'profile_create',
  'profile_update',
  'child_create',
  'child_update',
  'child_delete',
  'symbol_upload',
  'symbol_moderate',
  'session_export',
  'consent_grant',
  'consent_revoke',
  'data_export',
  'data_delete',
  'admin_action',
  'therapist_note_update',
] as const;

const WINDOWS = [7, 30, 90] as const;

interface Props {
  locale: 'en' | 'ar';
}

export function AdminAuditClient({ locale }: Props) {
  const T = LABELS[locale];
  const [page, setPage] = useState(1);
  const [actorSearch, setActorSearch] = useState('');
  const [debouncedActor, setDebouncedActor] = useState('');
  const [action, setAction] = useState<string>('all');
  const [windowDays, setWindowDays] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedActor(actorSearch), 250);
    return () => clearTimeout(t);
  }, [actorSearch]);

  const query = trpc.admin.auditList.useQuery({
    actorSearch: debouncedActor || undefined,
    action: action === 'all' ? undefined : action,
    sinceDays: windowDays,
    page,
    pageSize: 50,
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / 50));

  return (
    <main className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-fg text-3xl font-bold tracking-tight">{T.title}</h1>
        <p className="text-fg-muted text-sm">{T.subtitle}</p>
      </header>

      <section className="border-border-muted bg-bg-elevated grid gap-3 rounded-2xl border p-4 md:grid-cols-3">
        <input
          type="text"
          placeholder={T.actorPlaceholder}
          value={actorSearch}
          onChange={(e) => {
            setActorSearch(e.target.value);
            setPage(1);
          }}
          className="border-border bg-bg text-fg rounded-lg border px-3 py-2 text-sm"
        />
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="border-border bg-bg text-fg rounded-lg border px-3 py-2 text-sm"
          aria-label={T.actionLabel}
        >
          <option value="all">{T.allActions}</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          {WINDOWS.map((w) => (
            <Button
              key={w}
              type="button"
              size="sm"
              variant={w === windowDays ? 'primary' : 'ghost'}
              onClick={() => {
                setWindowDays(w);
                setPage(1);
              }}
            >
              {T.windowOption(w)}
            </Button>
          ))}
        </div>
      </section>

      {query.isLoading && (
        <div className="text-fg-muted flex items-center gap-2 text-sm">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {T.loading}
        </div>
      )}

      {query.data && query.data.rows.length === 0 && (
        <p className="text-fg-muted text-sm">{T.empty}</p>
      )}

      {query.data && query.data.rows.length > 0 && (
        <ul className="border-border-muted divide-border-muted divide-y rounded-2xl border">
          {query.data.rows.map((row) => (
            <AuditRow key={row.id} row={row} locale={locale} />
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="text-fg-muted">{T.pageOf(page, totalPages)}</span>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            <span className="ms-1">{T.prev}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            <span className="me-1">{T.next}</span>
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </main>
  );
}

function AuditRow({
  row,
  locale,
}: {
  row: {
    id: string;
    actor_id: string | null;
    actorEmail: string | null;
    action: string;
    target_type: string | null;
    target_id: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
  };
  locale: 'en' | 'ar';
}) {
  const [expanded, setExpanded] = useState(false);
  const T = LABELS[locale];
  return (
    <li className="bg-bg-elevated px-4 py-2.5">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="text-fg flex w-full items-center gap-3 text-start text-sm"
        aria-expanded={expanded}
      >
        <span className="text-fg-muted w-40 tabular-nums">
          {row.created_at.slice(0, 19).replace('T', ' ')}
        </span>
        <span className="bg-bg-muted text-fg rounded px-1.5 py-0.5 text-xs font-semibold">
          {row.action}
        </span>
        <span className="text-fg-muted text-xs">
          {row.actorEmail ?? (row.actor_id ? row.actor_id.slice(0, 8) : T.systemActor)}
        </span>
        {row.target_type && (
          <span className="text-fg-subtle text-xs">
            → {row.target_type}:{' '}
            <code className="font-mono">{row.target_id?.slice(0, 8) ?? '—'}</code>
          </span>
        )}
        <span className="text-fg-muted ms-auto">
          {expanded ? (
            <ChevronUp aria-hidden="true" className="h-4 w-4" />
          ) : (
            <ChevronDown aria-hidden="true" className="h-4 w-4" />
          )}
        </span>
      </button>
      {expanded && (
        <pre className="bg-bg/60 text-fg-muted mt-2 overflow-x-auto rounded-lg p-3 text-xs">
          {JSON.stringify(row.metadata, null, 2)}
        </pre>
      )}
    </li>
  );
}

const LABELS = {
  en: {
    title: 'Audit log',
    subtitle: 'Read-only system audit. Newest first. Click a row to expand metadata.',
    actorPlaceholder: 'Search actor by email or UUID prefix…',
    actionLabel: 'Filter by action',
    allActions: 'All actions',
    windowOption: (n: number) => `Last ${n}d`,
    loading: 'Loading events…',
    empty: 'No events in this window.',
    pageOf: (a: number, b: number) => `Page ${a} of ${b}`,
    prev: 'Previous',
    next: 'Next',
    systemActor: 'system',
  },
  ar: {
    title: 'سجل التدقيق',
    subtitle: 'سجل قراءة فقط. الأحدث أوّلًا. اضغط على صف لعرض البيانات الوصفية.',
    actorPlaceholder: 'ابحث عن المنفّذ بالبريد أو بداية المعرّف…',
    actionLabel: 'تصفية حسب الإجراء',
    allActions: 'كل الإجراءات',
    windowOption: (n: number) => `آخر ${n} يومًا`,
    loading: 'جاري التحميل…',
    empty: 'لا توجد أحداث في هذه الفترة.',
    pageOf: (a: number, b: number) => `صفحة ${a} من ${b}`,
    prev: 'السابق',
    next: 'التالي',
    systemActor: 'نظام',
  },
} as const;
