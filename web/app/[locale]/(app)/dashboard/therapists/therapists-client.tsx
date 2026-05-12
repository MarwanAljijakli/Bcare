'use client';

import { ArrowLeft, Copy, Loader2, Trash2, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';

interface Props {
  locale: 'en' | 'ar';
}

export function TherapistsDashboardClient({ locale }: Props) {
  const list = trpc.invites.listOutgoing.useQuery();
  const issue = trpc.invites.issue.useMutation({ onSuccess: () => list.refetch() });
  const revoke = trpc.invites.revoke.useMutation({ onSuccess: () => list.refetch() });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const childId = (list.data?.invites[0]?.child_id ?? list.data?.grants[0]?.child_id) as
    | string
    | undefined;

  function copy(code: string, id: string) {
    void navigator.clipboard.writeText(code);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1500);
  }

  const T = LABELS[locale];
  const activeGrants = (list.data?.grants ?? []).filter((g) => !g.revoked_at);
  const pendingInvites = (list.data?.invites ?? []).filter(
    (i) => !i.revoked_at && !i.accepted_at && new Date(i.expires_at).getTime() > Date.now(),
  );
  const otherInvites = (list.data?.invites ?? []).filter((i) => !pendingInvites.includes(i));

  return (
    <main className="container space-y-8 py-10">
      <header className="space-y-2">
        <Link
          href={`/${locale}/dashboard`}
          className="text-fg-muted hover:text-fg inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          {T.back}
        </Link>
        <h1 className="text-fg text-3xl font-bold tracking-tight">{T.title}</h1>
        <p className="text-fg-muted max-w-2xl text-base leading-relaxed">{T.subtitle}</p>
      </header>

      <Button
        type="button"
        size="md"
        onClick={() => childId && issue.mutate({ childId })}
        disabled={!childId || issue.isPending}
      >
        {issue.isPending ? (
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        ) : (
          <UserPlus aria-hidden="true" className="h-4 w-4" />
        )}
        <span className="ms-2">{issue.isPending ? T.issuing : T.issueInvite}</span>
      </Button>

      <section aria-labelledby="grants-heading" className="space-y-3">
        <h2 id="grants-heading" className="text-fg text-lg font-semibold">
          {T.activeGrantsHeading}
        </h2>
        {list.isLoading && (
          <div className="text-fg-muted flex items-center gap-2 text-sm">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            {T.loading}
          </div>
        )}
        {!list.isLoading && activeGrants.length === 0 && (
          <p className="text-fg-subtle text-sm">{T.noGrants}</p>
        )}
        <ul className="space-y-2">
          {activeGrants.map((g) => (
            <li
              key={g.id}
              className="border-border bg-bg-elevated flex items-center gap-3 rounded-xl border p-3"
            >
              <span className="text-fg flex-1 text-sm font-medium">
                {T.therapistOnGrant} · {T.since} {new Date(g.granted_at).toLocaleDateString()}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => revoke.mutate({ kind: 'grant', id: g.id })}
                disabled={revoke.isPending}
              >
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="ms-1">{T.revokeGrant}</span>
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="invites-heading" className="space-y-3">
        <h2 id="invites-heading" className="text-fg text-lg font-semibold">
          {T.pendingInvitesHeading}
        </h2>
        {!list.isLoading && pendingInvites.length === 0 && (
          <p className="text-fg-subtle text-sm">{T.noInvites}</p>
        )}
        <ul className="space-y-2">
          {pendingInvites.map((inv) => (
            <li
              key={inv.id}
              className="border-border bg-bg-elevated flex items-center gap-3 rounded-xl border p-3"
            >
              <code className="text-fg font-mono text-sm">{inv.code}</code>
              <span className="text-fg-subtle text-xs">
                {T.expires} {new Date(inv.expires_at).toLocaleDateString()}
              </span>
              <div className="ms-auto flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => copy(inv.code, inv.id)}
                >
                  <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                  <span className="ms-1">{copiedId === inv.id ? T.copied : T.copy}</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => revoke.mutate({ kind: 'invite', id: inv.id })}
                  disabled={revoke.isPending}
                >
                  <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                  <span className="ms-1">{T.revoke}</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {otherInvites.length > 0 && (
        <section aria-labelledby="history-heading" className="space-y-3">
          <h2 id="history-heading" className="text-fg-muted text-sm font-semibold uppercase">
            {T.historyHeading}
          </h2>
          <ul className="space-y-2">
            {otherInvites.map((inv) => {
              const expired = new Date(inv.expires_at).getTime() < Date.now();
              const status = inv.accepted_at
                ? T.accepted
                : inv.revoked_at
                  ? T.revoked
                  : expired
                    ? T.expired
                    : T.pending;
              return (
                <li
                  key={inv.id}
                  className="border-border-muted bg-bg/40 flex items-center gap-3 rounded-xl border p-3 text-sm"
                >
                  <code className="text-fg-subtle font-mono text-sm line-through">{inv.code}</code>
                  <span className="text-fg-subtle text-xs">{status}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}

const LABELS = {
  en: {
    back: 'Back to dashboard',
    title: 'Therapist sharing',
    subtitle:
      'Issue a single-use 12-character code to a therapist. They sign up, paste the code, and get read access to your child’s sessions + the ability to write notes. Revoke at any time.',
    issueInvite: 'Issue invite',
    issuing: 'Issuing…',
    activeGrantsHeading: 'Active grants',
    noGrants: 'No therapists have access yet.',
    therapistOnGrant: 'Therapist',
    since: 'Since',
    revokeGrant: 'Revoke access',
    pendingInvitesHeading: 'Pending invites',
    noInvites: 'No outstanding invites.',
    expires: 'Expires',
    copy: 'Copy code',
    copied: 'Copied!',
    revoke: 'Revoke',
    historyHeading: 'History',
    accepted: 'Accepted',
    revoked: 'Revoked',
    expired: 'Expired',
    pending: 'Pending',
    loading: 'Loading…',
  },
  ar: {
    back: 'عودة إلى لوحة القيادة',
    title: 'مشاركة مع المعالج',
    subtitle:
      'أصدر رمزًا من 12 حرفًا قابلًا للاستخدام مرة واحدة. سيقوم المعالج بالتسجيل ولصق الرمز، ثم يحصل على إذن القراءة لجلسات طفلك وكتابة الملاحظات. يمكنك الإلغاء في أي وقت.',
    issueInvite: 'إصدار رمز',
    issuing: 'جاري الإصدار…',
    activeGrantsHeading: 'الإذونات النشطة',
    noGrants: 'لا يوجد معالجون لديهم وصول بعد.',
    therapistOnGrant: 'معالج',
    since: 'منذ',
    revokeGrant: 'إلغاء الإذن',
    pendingInvitesHeading: 'الرموز المُعلَّقة',
    noInvites: 'لا توجد رموز معلّقة.',
    expires: 'ينتهي',
    copy: 'نسخ الرمز',
    copied: 'تم النسخ!',
    revoke: 'إلغاء',
    historyHeading: 'السجل',
    accepted: 'مقبول',
    revoked: 'مُلغى',
    expired: 'منتهي',
    pending: 'معلّق',
    loading: 'جاري التحميل…',
  },
} as const;
