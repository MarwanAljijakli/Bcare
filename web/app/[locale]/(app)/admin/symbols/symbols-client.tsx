'use client';

import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';

type RejectReason =
  | 'blurry'
  | 'wrong_subject'
  | 'inappropriate'
  | 'copyright'
  | 'duplicate'
  | 'other';

const REJECT_REASONS: RejectReason[] = [
  'blurry',
  'wrong_subject',
  'inappropriate',
  'copyright',
  'duplicate',
  'other',
];

interface Props {
  locale: 'en' | 'ar';
}

export function AdminSymbolsClient({ locale }: Props) {
  const T = LABELS[locale];
  const queue = trpc.admin.symbolsQueue.useQuery();
  const approve = trpc.admin.symbolsApprove.useMutation({ onSuccess: () => queue.refetch() });
  const reject = trpc.admin.symbolsReject.useMutation({ onSuccess: () => queue.refetch() });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = queue.data?.rows ?? [];
  const allSelected = rows.length > 0 && selected.size === rows.length;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  }

  async function handleBulkApprove() {
    if (selected.size === 0) return;
    await approve.mutateAsync({ symbolIds: Array.from(selected) });
    setSelected(new Set());
  }

  function imageUrl(path: string | null): string | null {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    if (!supabaseUrl) return null;
    return `${supabaseUrl}/storage/v1/object/public/${path}`;
  }

  return (
    <main className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-fg text-3xl font-bold tracking-tight">{T.title}</h1>
        <p className="text-fg-muted text-sm">{T.subtitle}</p>
      </header>

      {queue.isLoading && (
        <div className="text-fg-muted flex items-center gap-2 text-sm">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {T.loading}
        </div>
      )}

      {queue.data && rows.length === 0 && (
        <p className="border-border-muted bg-bg-elevated rounded-2xl border border-dashed p-6 text-sm">
          {T.empty}
        </p>
      )}

      {rows.length > 0 && (
        <>
          <div className="border-border-muted bg-bg-elevated flex items-center gap-3 rounded-xl border p-3">
            <label className="text-fg flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-4 w-4 rounded"
              />
              {T.selectAll}
            </label>
            <span className="text-fg-muted text-xs">
              {selected.size} / {rows.length} {T.selectedSuffix}
            </span>
            <Button
              type="button"
              size="sm"
              onClick={handleBulkApprove}
              disabled={selected.size === 0 || approve.isPending}
              className="ms-auto"
            >
              {approve.isPending ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              )}
              <span className="ms-2">{T.bulkApprove}</span>
            </Button>
          </div>

          <ul className="space-y-3">
            {rows.map((sym) => {
              const url = imageUrl(sym.image_path);
              return (
                <li
                  key={sym.id}
                  className="border-border bg-bg-elevated flex items-start gap-4 rounded-2xl border p-4"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(sym.id)}
                    onChange={() => toggle(sym.id)}
                    className="mt-1 h-4 w-4 rounded"
                    aria-label={T.selectAria}
                  />
                  {url ? (
                    <Image
                      src={url}
                      alt={sym.label_en ?? ''}
                      width={96}
                      height={96}
                      className="border-border-muted h-24 w-24 rounded-lg border bg-white object-contain"
                      unoptimized
                    />
                  ) : (
                    <div className="border-border-muted bg-bg-muted text-fg-subtle flex h-24 w-24 items-center justify-center rounded-lg border text-xs">
                      {T.noImage}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-fg font-semibold" dir="auto">
                      {sym.label_en ?? '—'}
                    </p>
                    <p className="text-fg-muted text-sm" dir="rtl">
                      {sym.label_ar ?? '—'}
                    </p>
                    <p className="text-fg-subtle mt-2 text-xs">
                      {T.category}: {sym.category ?? '—'} · {T.source}: {sym.source}
                    </p>
                    <p className="text-fg-subtle text-xs">
                      {T.uploaded}: {sym.created_at.slice(0, 16).replace('T', ' ')}
                    </p>
                  </div>
                  <SymbolActions
                    locale={locale}
                    onApprove={() => approve.mutate({ symbolIds: [sym.id] })}
                    onReject={(reason) => reject.mutate({ symbolId: sym.id, reason })}
                    isPending={approve.isPending || reject.isPending}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}

function SymbolActions({
  locale,
  onApprove,
  onReject,
  isPending,
}: {
  locale: 'en' | 'ar';
  onApprove: () => void;
  onReject: (reason: RejectReason) => void;
  isPending: boolean;
}) {
  const T = LABELS[locale];
  const [showReasons, setShowReasons] = useState(false);
  const reasonLabels = useMemo<Record<RejectReason, string>>(
    () => T.rejectReasons,
    [T.rejectReasons],
  );
  return (
    <div className="flex flex-col gap-2">
      <Button type="button" size="sm" onClick={onApprove} disabled={isPending}>
        <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
        <span className="ms-1">{T.approve}</span>
      </Button>
      <div className="relative">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setShowReasons((s) => !s)}
          disabled={isPending}
        >
          <XCircle aria-hidden="true" className="h-4 w-4" />
          <span className="ms-1">{T.reject}</span>
        </Button>
        {showReasons && (
          <div className="border-border bg-bg-elevated absolute end-0 top-full z-10 mt-1 w-44 rounded-lg border p-1 shadow-lg">
            {REJECT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setShowReasons(false);
                  onReject(r);
                }}
                className="text-fg hover:bg-bg-muted block w-full rounded px-2 py-1.5 text-start text-sm"
              >
                {reasonLabels[r]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const LABELS = {
  en: {
    title: 'Symbol moderation',
    subtitle:
      'Custom symbols submitted by caregivers awaiting approval. Approve to publish or reject with a reason.',
    loading: 'Loading queue…',
    empty: 'Queue is empty — no symbols pending review.',
    selectAll: 'Select all',
    selectedSuffix: 'selected',
    selectAria: 'Select symbol for bulk action',
    bulkApprove: 'Approve selected',
    noImage: 'no image',
    category: 'Category',
    source: 'Source',
    uploaded: 'Uploaded',
    approve: 'Approve',
    reject: 'Reject',
    rejectReasons: {
      blurry: 'Blurry / low quality',
      wrong_subject: 'Wrong subject',
      inappropriate: 'Inappropriate',
      copyright: 'Copyright issue',
      duplicate: 'Duplicate',
      other: 'Other',
    },
  },
  ar: {
    title: 'مراجعة الرموز',
    subtitle:
      'الرموز المخصّصة المرسلة من قِبل مقدّمي الرعاية في انتظار الموافقة. وافق للنشر أو ارفض مع تحديد السبب.',
    loading: 'جاري التحميل…',
    empty: 'القائمة فارغة — لا توجد رموز قيد المراجعة.',
    selectAll: 'تحديد الكل',
    selectedSuffix: 'محدّد',
    selectAria: 'تحديد رمز للإجراء المجمّع',
    bulkApprove: 'الموافقة على المحدّد',
    noImage: 'لا توجد صورة',
    category: 'الفئة',
    source: 'المصدر',
    uploaded: 'تاريخ الرفع',
    approve: 'موافقة',
    reject: 'رفض',
    rejectReasons: {
      blurry: 'ضبابي / جودة منخفضة',
      wrong_subject: 'موضوع خاطئ',
      inappropriate: 'غير ملائم',
      copyright: 'مشكلة حقوق نشر',
      duplicate: 'مكرّر',
      other: 'آخر',
    },
  },
} as const;
