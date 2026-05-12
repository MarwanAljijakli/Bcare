'use client';

import { ArrowLeft, Check, Loader2, Mail } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  locale: 'en' | 'ar';
}

export function ResetRequestClient({ locale }: Props) {
  const T = LABELS[locale];
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale }),
      });
    } finally {
      // Always succeed visually — anti-enumeration.
      setSubmitted(true);
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <section className="space-y-6 text-center">
        <div className="bg-success/10 mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full">
          <Check aria-hidden="true" className="text-success h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h1 className="text-fg text-3xl font-bold">{T.sentTitle}</h1>
          <p className="text-fg-muted text-balance">{T.sentBody}</p>
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link href={`/${locale}/login`}>
            <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="ms-1">{T.backToLogin}</span>
          </Link>
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
          <span className="text-fg text-sm font-medium">{T.emailLabel}</span>
          <div className="relative">
            <Mail
              aria-hidden="true"
              className="text-fg-muted pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              dir="ltr"
              className="border-border bg-bg text-fg focus:ring-fg/30 w-full rounded-lg border py-2.5 pe-3 ps-9 text-base focus:outline-none focus:ring-2"
            />
          </div>
        </label>
        <Button type="submit" size="lg" disabled={submitting || !email} className="w-full">
          {submitting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
          <span className={submitting ? 'ms-2' : ''}>{submitting ? T.sending : T.send}</span>
        </Button>
      </form>
      <Link
        href={`/${locale}/login`}
        className="text-fg-muted hover:text-fg block text-center text-sm"
      >
        {T.backToLogin}
      </Link>
    </section>
  );
}

const LABELS = {
  en: {
    title: 'Reset password',
    subtitle: 'Enter your account email and we will send a reset link.',
    emailLabel: 'Email',
    send: 'Send reset link',
    sending: 'Sending…',
    sentTitle: 'Check your email',
    sentBody:
      'If an account exists for that email, a reset link is on its way. The link expires in one hour.',
    backToLogin: 'Back to sign in',
  },
  ar: {
    title: 'إعادة تعيين كلمة المرور',
    subtitle: 'أدخل بريد حسابك وسنرسل رابط إعادة التعيين.',
    emailLabel: 'البريد الإلكتروني',
    send: 'إرسال رابط إعادة التعيين',
    sending: 'جاري الإرسال…',
    sentTitle: 'تحقّق من بريدك',
    sentBody:
      'إن كان هناك حساب بهذا البريد، فقد أُرسل إليك رابط إعادة تعيين. ينتهي الرابط خلال ساعة.',
    backToLogin: 'عودة إلى تسجيل الدخول',
  },
} as const;
