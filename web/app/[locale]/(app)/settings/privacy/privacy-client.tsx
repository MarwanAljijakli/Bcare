'use client';

import { Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PinGate } from '@/components/pin-gate';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';

const SCOPES = [
  'data_processing',
  'ai_personalization',
  'voice_recording',
  'webcam_processing',
  'analytics_dashboard',
] as const;
type Scope = (typeof SCOPES)[number];

export function PrivacySettings() {
  const t = useTranslations('marketing.app.settings.privacy');
  const list = trpc.consent.list.useQuery();
  const revoke = trpc.consent.revoke.useMutation({
    onSuccess: () => list.refetch(),
  });
  const [confirming, setConfirming] = useState<Scope | null>(null);

  // Compute the latest grant per scope (rows arrive in DESC order).
  const latestByScope = new Map<Scope, { granted: boolean; created_at: string }>();
  for (const row of list.data ?? []) {
    if (SCOPES.includes(row.scope as Scope) && !latestByScope.has(row.scope as Scope)) {
      latestByScope.set(row.scope as Scope, { granted: row.granted, created_at: row.created_at });
    }
  }

  return (
    <section className="max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-fg text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-fg-muted text-base leading-relaxed">{t('subtitle')}</p>
      </header>
      {list.isLoading && (
        <div className="text-fg-muted flex items-center gap-2 text-sm">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {t('loading')}
        </div>
      )}
      {!list.isLoading && (
        <ul className="border-border bg-bg-elevated divide-border divide-y rounded-2xl border">
          {SCOPES.map((scope) => {
            const latest = latestByScope.get(scope);
            const isGranted = latest?.granted ?? false;
            return (
              <li key={scope} className="flex items-start gap-4 p-4">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${isGranted ? 'bg-success/10 text-success' : 'bg-bg-muted text-fg-subtle'}`}
                >
                  {isGranted ? (
                    <ShieldCheck className="h-4 w-4" />
                  ) : (
                    <ShieldOff className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-fg text-sm font-semibold">{t(`scopes.${scope}.label`)}</h2>
                  <p className="text-fg-muted mt-1 text-xs leading-relaxed">
                    {t(`scopes.${scope}.description`)}
                  </p>
                  <p className="text-fg-subtle mt-2 text-xs">
                    {isGranted
                      ? t('grantedAt', { date: formatDate(latest?.created_at) })
                      : t('notGranted')}
                  </p>
                </div>
                {isGranted && (
                  <div className="shrink-0">
                    {confirming === scope ? (
                      <PinGate
                        autoArm
                        actionLabel={t(`scopes.${scope}.label`)}
                        onUnlock={() =>
                          revoke.mutate({ scope }, { onSettled: () => setConfirming(null) })
                        }
                        renderUnlocked={() => (
                          <span className="text-fg-muted inline-flex items-center gap-2 text-xs">
                            {revoke.isPending && (
                              <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
                            )}
                            {t('revoking')}
                          </span>
                        )}
                      />
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setConfirming(scope)}
                      >
                        {t('revoke')}
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-fg-subtle text-xs">{t('historyNote')}</p>
    </section>
  );
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}
