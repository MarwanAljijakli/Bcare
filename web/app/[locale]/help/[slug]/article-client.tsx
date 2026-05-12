'use client';

import { ArrowLeft, Check, Link2, ThumbsDown, ThumbsUp } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { HelpArticle } from '@/content/help';
import { Button } from '@/components/ui/button';

interface Props {
  locale: 'en' | 'ar';
  article: HelpArticle;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

export function ArticleClient({ locale, article }: Props) {
  const T = LABELS[locale];
  const [voted, setVoted] = useState<'up' | 'down' | null>(null);
  const [copiedAnchor, setCopiedAnchor] = useState<string | null>(null);

  function copyLink(anchor: string) {
    const url = `${window.location.origin}${window.location.pathname}#${anchor}`;
    void navigator.clipboard.writeText(url);
    setCopiedAnchor(anchor);
    window.setTimeout(() => setCopiedAnchor(null), 1500);
  }

  async function submitFeedback(helpful: boolean) {
    if (voted) return;
    setVoted(helpful ? 'up' : 'down');
    try {
      // Help is a public surface (outside the TrpcProvider tree); use a
      // plain fetch to the public POST endpoint instead of trpc.
      await fetch('/api/help/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: article.slug, locale, helpful }),
      });
    } catch {
      /* anonymous — failure is silent, keep the UI optimistic */
    }
  }

  const tocItems = article.sections.map((s) => ({
    anchor: slugify(s.heading),
    heading: s.heading,
  }));

  return (
    <main className="container py-10">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px]">
        <article className="prose-like max-w-3xl space-y-6">
          <Link
            href={`/${locale}/help`}
            className="text-fg-muted hover:text-fg inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            {T.back}
          </Link>

          <header className="space-y-2">
            <h1 className="text-fg text-4xl font-bold tracking-tight" dir="auto">
              {article.title}
            </h1>
            <p className="text-fg-subtle text-xs">
              {T.lastUpdated} <time dateTime={article.updatedAt}>{article.updatedAt}</time>
            </p>
            <p className="text-fg-muted text-base leading-relaxed" dir="auto">
              {article.lead}
            </p>
          </header>

          {article.sections.map((section) => {
            const anchor = slugify(section.heading);
            return (
              <section key={anchor} id={anchor} className="scroll-mt-24 space-y-3">
                <h2 className="text-fg group flex items-center gap-2 text-2xl font-bold" dir="auto">
                  <span>{section.heading}</span>
                  <button
                    type="button"
                    onClick={() => copyLink(anchor)}
                    aria-label={T.copyLinkAria(section.heading)}
                    className="text-fg-subtle opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
                  >
                    {copiedAnchor === anchor ? (
                      <Check aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <Link2 aria-hidden="true" className="h-4 w-4" />
                    )}
                  </button>
                </h2>
                {section.paragraphs.map((p, idx) => (
                  <p key={idx} className="text-fg text-base leading-relaxed" dir="auto">
                    {p}
                  </p>
                ))}
                {section.list && (
                  <ul className="text-fg ms-6 list-disc space-y-1.5" dir="auto">
                    {section.list.map((item, idx) => (
                      <li key={idx} className="text-base leading-relaxed">
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          <section
            aria-labelledby="feedback-heading"
            className="border-border-muted bg-bg-elevated mt-12 rounded-2xl border p-5"
          >
            <h2 id="feedback-heading" className="text-fg text-lg font-bold">
              {T.feedbackHeading}
            </h2>
            {voted ? (
              <p className="text-fg-muted mt-2 text-sm">{T.feedbackThanks}</p>
            ) : (
              <div className="mt-3 flex gap-3">
                <Button type="button" size="sm" onClick={() => submitFeedback(true)}>
                  <ThumbsUp aria-hidden="true" className="h-4 w-4" />
                  <span className="ms-2">{T.helpful}</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => submitFeedback(false)}
                >
                  <ThumbsDown aria-hidden="true" className="h-4 w-4" />
                  <span className="ms-2">{T.notHelpful}</span>
                </Button>
              </div>
            )}
          </section>
        </article>

        <aside className="hidden lg:block">
          <nav
            aria-label={T.tocAria}
            className="border-border-muted bg-bg-elevated sticky top-24 rounded-2xl border p-4"
          >
            <p className="text-fg-subtle mb-2 text-xs font-semibold uppercase tracking-wide">
              {T.tocTitle}
            </p>
            <ul className="space-y-1.5">
              {tocItems.map((item) => (
                <li key={item.anchor}>
                  <a
                    href={`#${item.anchor}`}
                    className="text-fg-muted hover:text-fg block truncate text-sm"
                  >
                    {item.heading}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
    </main>
  );
}

const LABELS = {
  en: {
    back: 'Back to help center',
    lastUpdated: 'Last updated',
    copyLinkAria: (heading: string) => `Copy link to "${heading}" section`,
    tocAria: 'Table of contents',
    tocTitle: 'On this page',
    feedbackHeading: 'Was this article helpful?',
    feedbackThanks: 'Thanks for the feedback.',
    helpful: 'Yes, helpful',
    notHelpful: 'No, not helpful',
  },
  ar: {
    back: 'عودة إلى مركز المساعدة',
    lastUpdated: 'آخر تحديث',
    copyLinkAria: (heading: string) => `انسخ رابط قسم "${heading}"`,
    tocAria: 'جدول المحتويات',
    tocTitle: 'في هذه الصفحة',
    feedbackHeading: 'هل كانت هذه المقالة مفيدة؟',
    feedbackThanks: 'شكرًا على ملاحظتك.',
    helpful: 'نعم، مفيدة',
    notHelpful: 'لا، غير مفيدة',
  },
} as const;
