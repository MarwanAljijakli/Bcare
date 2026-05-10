'use client';

import { Loader2, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc/client';

/**
 * PinGate — wraps a sensitive action behind a 6-digit parental PIN
 * challenge. Used by Settings → Privacy (consent revocation), Settings →
 * Account (export/delete), and Module 4 vocabulary curation.
 *
 * Three wrong attempts within a 5-minute window triggers a 5-minute
 * lockout (state lives server-side; client surfaces the message).
 *
 * Usage:
 *   <PinGate onUnlock={() => doSensitiveThing()}>
 *     <Button onClick={armed}>Delete account</Button>
 *   </PinGate>
 *
 * The challenge slides in inline above the children when armed; once the
 * PIN verifies the children re-mount with `unlocked=true` via
 * render-prop (see `renderUnlocked`).
 */

interface PinGateProps {
  /** Optional render-prop receiving the unlock state. */
  children?: ReactNode;
  renderUnlocked?: () => ReactNode;
  /** Called the moment the PIN verifies. */
  onUnlock?: () => void;
  /** When true, the gate auto-arms on mount instead of requiring a click. */
  autoArm?: boolean;
  /** Used to label the action — e.g. "Revoke consent", "Delete account". */
  actionLabel: string;
}

export function PinGate({
  children,
  renderUnlocked,
  onUnlock,
  autoArm = false,
  actionLabel,
}: PinGateProps) {
  const t = useTranslations('marketing.app.pinGate');
  const [armed, setArmed] = useState(autoArm);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const verify = trpc.account.pin.verify.useMutation();

  async function submit() {
    if (!/^[0-9]{6}$/.test(pin)) {
      setError(t('formatError'));
      return;
    }
    setError(null);
    try {
      await verify.mutateAsync({ pin });
      setUnlocked(true);
      onUnlock?.();
    } catch (e: unknown) {
      const code = e instanceof Error ? e.message : 'wrong_pin';
      if (code === 'pin_not_set') setError(t('notSet'));
      else if (code === 'locked_out') setError(t('lockedOut'));
      else setError(t('wrong'));
      setPin('');
    }
  }

  if (unlocked) {
    return <>{renderUnlocked ? renderUnlocked() : children}</>;
  }

  if (!armed) {
    return (
      <Button type="button" variant="secondary" size="md" onClick={() => setArmed(true)}>
        <Lock aria-hidden="true" className="h-4 w-4" />
        {actionLabel}
      </Button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="border-border bg-bg-elevated space-y-3 rounded-2xl border p-4"
      aria-labelledby="pingate-title"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="bg-primary/10 text-primary grid h-8 w-8 place-items-center rounded-lg"
        >
          <Lock className="h-4 w-4" />
        </span>
        <h2 id="pingate-title" className="text-fg text-sm font-semibold">
          {t('title')}
        </h2>
      </div>
      <p className="text-fg-muted text-xs leading-relaxed">
        {t('subtitle', { action: actionLabel })}
      </p>
      <div>
        <Label htmlFor="pingate-pin" className="sr-only">
          {t('pinLabel')}
        </Label>
        <Input
          id="pingate-pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          pattern="[0-9]{6}"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="tracking-widest"
          placeholder="• • • • • •"
          aria-invalid={!!error || undefined}
          autoFocus
        />
      </div>
      {error && (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setArmed(false);
            setPin('');
            setError(null);
          }}
        >
          {t('cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={verify.isPending}>
          {verify.isPending ? (
            <>
              <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              {t('verifying')}
            </>
          ) : (
            t('unlock')
          )}
        </Button>
      </div>
    </form>
  );
}
