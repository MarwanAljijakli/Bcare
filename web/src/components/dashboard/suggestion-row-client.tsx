'use client';

import { Check, Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { DashboardSuggestion } from '@/server/dashboard/types';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';

/**
 * Single pending-suggestion row + approve / reject controls.
 *
 * The dashboard surface is RSC, so we use `router.refresh()` to repaint
 * after a mutation rather than tRPC cache invalidation. The audit-log
 * row is written by the existing `personalization.approve / reject`
 * procedures (kind=`vocab_suggestion_approved` / `_rejected`); this
 * component does not write to audit_log directly.
 */
export function SuggestionRowClient({
  suggestion,
  labels,
}: {
  suggestion: DashboardSuggestion;
  labels: {
    approve: string;
    reject: string;
    sourceFrequency: string;
    sourceLlm: string;
    pending: string;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  const approve = trpc.personalization.approve.useMutation({
    onSettled: () => {
      setBusy(null);
      router.refresh();
    },
  });
  const reject = trpc.personalization.reject.useMutation({
    onSettled: () => {
      setBusy(null);
      router.refresh();
    },
  });

  const isBusy = busy !== null;

  return (
    <li className="border-border-muted bg-bg/40 flex items-center gap-3 rounded-xl border p-3">
      <div className="min-w-0 flex-1">
        <p className="text-fg truncate text-sm font-semibold">{suggestion.symbol.label}</p>
        <p className="text-fg-subtle mt-0.5 text-xs">
          {suggestion.source === 'llm' ? labels.sourceLlm : labels.sourceFrequency}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isBusy}
          onClick={() => {
            setBusy('reject');
            reject.mutate({ suggestionId: suggestion.id });
          }}
          aria-label={labels.reject}
        >
          {busy === 'reject' ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <X aria-hidden="true" className="h-4 w-4" />
          )}
          <span className="ms-1">{labels.reject}</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={isBusy}
          onClick={() => {
            setBusy('approve');
            approve.mutate({ suggestionId: suggestion.id });
          }}
          aria-label={labels.approve}
        >
          {busy === 'approve' ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <Check aria-hidden="true" className="h-4 w-4" />
          )}
          <span className="ms-1">{labels.approve}</span>
        </Button>
      </div>
    </li>
  );
}
