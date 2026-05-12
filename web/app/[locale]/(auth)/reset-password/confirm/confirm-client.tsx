'use client';

import { Check, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface Props {
  locale: 'en' | 'ar';
}

export function ResetConfirmClient({ locale }: Props) {
  const T = LABELS[locale];
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 12) {
      setError(T.tooShort);
      return;
    }
    if (password !== confirm) {
      setError(T.mismatch);
      return;
    }
    setSubmitting(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) {
        setError(updErr.message);
        return;
      }
      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <section className="space-y-6 text-center">
        <div className="bg-success/10 mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full">
          <Check aria-hidden="true" className="text-success h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h1 className="text-fg text-3xl font-bold">{T.successTitle}</h1>
          <p className="text-fg-muted">{T.successBody}</p>
        </div>
        <Button asChild size="lg">
          <Link href={`/${locale}/login`}>{T.goToLogin}</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="text-fg text-3xl font-bold">{T.title}</h1>
        <p className="text-fg-muted text-sm">{T.subtitle}</p>
      </header>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-fg text-sm font-medium">{T.newLabel}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={12}
            required
            autoComplete="new-password"
            className="border-border bg-bg text-fg focus:ring-fg/30 w-full rounded-lg border px-3 py-2.5 text-base focus:outline-none focus:ring-2"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-fg text-sm font-medium">{T.confirmLabel}</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={12}
            required
            autoComplete="new-password"
            className="border-border bg-bg text-fg focus:ring-fg/30 w-full rounded-lg border px-3 py-2.5 text-base focus:outline-none focus:ring-2"
          />
        </label>
        <p className="text-fg-subtle text-xs">{T.requirements}</p>
        {error && <p className="text-sm text-amber-700 dark:text-amber-300">{error}</p>}
        <Button type="submit" size="lg" disabled={submitting} className="w-full">
          {submitting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
          <span className={submitting ? 'ms-2' : ''}>{submitting ? T.submitting : T.submit}</span>
        </Button>
      </form>
    </section>
  );
}

const LABELS = {
  en: {
    title: 'Set a new password',
    subtitle: 'Enter a strong password to finish your reset.',
    newLabel: 'New password',
    confirmLabel: 'Confirm new password',
    requirements: 'Minimum 12 characters. Mix of letters, numbers, and symbols recommended.',
    submit: 'Update password',
    submitting: 'Updating…',
    tooShort: 'Password must be at least 12 characters.',
    mismatch: 'Passwords do not match.',
    successTitle: 'Password updated',
    successBody: 'You can now sign in with your new password.',
    goToLogin: 'Go to sign in',
  },
  ar: {
    title: 'تعيين كلمة مرور جديدة',
    subtitle: 'أدخل كلمة مرور قوية لإكمال إعادة التعيين.',
    newLabel: 'كلمة المرور الجديدة',
    confirmLabel: 'تأكيد كلمة المرور الجديدة',
    requirements: 'الحدّ الأدنى ١٢ حرفًا. يُنصح بمزيج من الحروف والأرقام والرموز.',
    submit: 'تحديث كلمة المرور',
    submitting: 'جاري التحديث…',
    tooShort: 'يجب أن تكون كلمة المرور ١٢ حرفًا على الأقلّ.',
    mismatch: 'كلمتا المرور غير متطابقتين.',
    successTitle: 'تم تحديث كلمة المرور',
    successBody: 'يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.',
    goToLogin: 'الذهاب إلى تسجيل الدخول',
  },
} as const;
