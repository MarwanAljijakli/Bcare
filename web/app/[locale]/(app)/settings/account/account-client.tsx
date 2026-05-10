'use client';

import { Download, Loader2, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PinGate } from '@/components/pin-gate';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/routing';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/auth/csrf-shared';

/**
 * Account settings — GDPR/PDPL data-portability + erasure UI.
 *
 * Both calls go to REST endpoints under /api/account/* rather than tRPC
 * because (a) the export needs to stream a file download with a
 * content-disposition header, and (b) the delete endpoint signs the user
 * out, which cleanly invalidates the in-flight tRPC client cache.
 *
 * Re-auth (≤ 5 min) is enforced server-side; the UI surfaces a "please
 * sign in again" prompt if the session is stale.
 */

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

export function AccountSettings() {
  const t = useTranslations('marketing.app.account');
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<{ eta: string } | null>(null);

  async function exportArchive() {
    setExportError(null);
    setExporting(true);
    try {
      const csrf = readCookie(CSRF_COOKIE) ?? '';
      const res = await fetch('/api/account/export', {
        method: 'POST',
        headers: { [CSRF_HEADER]: csrf },
        credentials: 'include',
      });
      if (res.status === 401) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (body.error === 'reauth_required') {
          setExportError(t('export.reauth'));
          return;
        }
      }
      if (!res.ok) {
        setExportError(t('export.reauth'));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = t('export.filename');
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    setDeleteError(null);
    setDeleting(true);
    try {
      const csrf = readCookie(CSRF_COOKIE) ?? '';
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { [CSRF_HEADER]: csrf },
        credentials: 'include',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (body.error === 'reauth_required') {
          setDeleteError(t('delete.reauth'));
          return;
        }
        setDeleteError(t('delete.reauth'));
        return;
      }
      const body = (await res.json()) as { hardDeleteEta: string };
      setDeleted({ eta: body.hardDeleteEta });
      // Soft-delete signed us out; bounce to /login after a moment so the
      // user can read the confirmation.
      window.setTimeout(() => router.push('/login'), 4000);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="max-w-2xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-fg text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-fg-muted text-base leading-relaxed">{t('subtitle')}</p>
      </header>

      <article className="border-border bg-bg-elevated space-y-3 rounded-2xl border p-5">
        <h2 className="text-fg flex items-center gap-2 text-lg font-semibold">
          <Download aria-hidden="true" className="text-primary h-5 w-5" />
          {t('export.title')}
        </h2>
        <p className="text-fg-muted text-sm leading-relaxed">{t('export.body')}</p>
        <div>
          <Button type="button" size="md" onClick={exportArchive} disabled={exporting}>
            {exporting ? (
              <>
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                {t('export.preparing')}
              </>
            ) : (
              <>
                <Download aria-hidden="true" className="h-4 w-4" />
                {t('export.cta')}
              </>
            )}
          </Button>
          {exportError && (
            <p role="alert" className="text-danger mt-2 text-xs">
              {exportError}
            </p>
          )}
        </div>
      </article>

      <article className="border-danger/30 bg-danger/5 space-y-3 rounded-2xl border p-5">
        <h2 className="text-fg flex items-center gap-2 text-lg font-semibold">
          <AlertTriangle aria-hidden="true" className="text-danger h-5 w-5" />
          {t('delete.title')}
        </h2>
        <p className="text-fg-muted text-sm leading-relaxed">{t('delete.body')}</p>
        {deleted ? (
          <div className="text-success flex items-start gap-2 text-sm">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="text-fg font-semibold">{t('delete.confirmedTitle')}</p>
              <p className="text-fg-muted mt-1 leading-relaxed">
                {t('delete.confirmedBody', { date: new Date(deleted.eta).toLocaleDateString() })}
              </p>
            </div>
          </div>
        ) : (
          <PinGate
            actionLabel={t('delete.actionLabel')}
            onUnlock={deleteAccount}
            renderUnlocked={() => (
              <div className="text-fg-muted flex items-center gap-2 text-sm">
                {deleting ? (
                  <>
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    {t('delete.confirming')}
                  </>
                ) : (
                  t('delete.confirming')
                )}
              </div>
            )}
          >
            <Button type="button" size="md" variant="primary" className="bg-danger hover:bg-danger">
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              {t('delete.cta')}
            </Button>
          </PinGate>
        )}
        {deleteError && (
          <p role="alert" className="text-danger text-xs">
            {deleteError}
          </p>
        )}
      </article>
    </section>
  );
}
