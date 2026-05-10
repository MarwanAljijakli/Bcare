'use client';

import { Copy, Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';

export function TherapistsSettings() {
  const t = useTranslations('marketing.app.settings.therapists');
  const list = trpc.invites.listOutgoing.useQuery();
  const issue = trpc.invites.issue.useMutation({ onSuccess: () => list.refetch() });
  const revoke = trpc.invites.revoke.useMutation({ onSuccess: () => list.refetch() });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pick the first child as the default invite target. Module 6 dashboard
  // adds a child-switcher to the header; for now invites scope to the
  // single onboarded child.
  const childId = (list.data?.invites[0]?.child_id ?? list.data?.grants[0]?.child_id) as
    | string
    | undefined;

  function copy(code: string, id: string) {
    void navigator.clipboard.writeText(code);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <section className="max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-fg text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-fg-muted text-base leading-relaxed">{t('subtitle')}</p>
      </header>

      <Button
        type="button"
        size="md"
        onClick={() => childId && issue.mutate({ childId })}
        disabled={!childId || issue.isPending}
      >
        {issue.isPending ? (
          <>
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            {t('issuing')}
          </>
        ) : (
          t('issue')
        )}
      </Button>

      <div className="space-y-2">
        <h2 className="text-fg text-lg font-semibold">{t('invitesLabel')}</h2>
        {list.isLoading && (
          <div className="text-fg-muted flex items-center gap-2 text-sm">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        )}
        {!list.isLoading && (list.data?.invites.length ?? 0) === 0 && (
          <p className="text-fg-subtle text-sm">{t('noInvites')}</p>
        )}
        <ul className="space-y-2">
          {list.data?.invites.map((inv) => {
            const expired = new Date(inv.expires_at).getTime() < Date.now();
            const dead = expired || !!inv.revoked_at || !!inv.accepted_at;
            return (
              <li
                key={inv.id}
                className="border-border bg-bg-elevated flex items-center gap-3 rounded-xl border p-3"
              >
                <code
                  className={`font-mono text-sm ${dead ? 'text-fg-subtle line-through' : 'text-fg'}`}
                >
                  {inv.code}
                </code>
                <span className="text-fg-subtle text-xs">
                  {inv.accepted_at
                    ? t('accepted')
                    : inv.revoked_at
                      ? t('revoked')
                      : expired
                        ? t('expired')
                        : t('expiresAt', { date: new Date(inv.expires_at).toLocaleDateString() })}
                </span>
                <div className="ms-auto flex gap-2">
                  {!dead && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => copy(inv.code, inv.id)}
                    >
                      <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                      {copiedId === inv.id ? t('copied') : t('copy')}
                    </Button>
                  )}
                  {!inv.revoked_at && !inv.accepted_at && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => revoke.mutate({ kind: 'invite', id: inv.id })}
                    >
                      <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                      {t('revoke')}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
