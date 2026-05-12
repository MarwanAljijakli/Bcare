'use client';

import Fuse from 'fuse.js';
import { ArrowRight, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { HelpArticle } from '@/content/help';

interface Props {
  locale: 'en' | 'ar';
  articles: HelpArticle[];
}

interface SearchableArticle {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  /** Concatenated section headings + paragraph bodies — gives Fuse
   *  enough corpus to surface mid-article matches without us shipping
   *  the entire article text to its index. */
  body: string;
}

export function HelpIndexClient({ locale, articles }: Props) {
  const T = LABELS[locale];
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 150);
    return () => clearTimeout(t);
  }, [query]);

  const corpus = useMemo<SearchableArticle[]>(
    () =>
      articles.map((a) => ({
        slug: a.slug,
        title: a.title,
        summary: a.summary,
        tags: a.tags,
        body: [
          a.lead,
          ...a.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.list ?? [])]),
        ].join(' '),
      })),
    [articles],
  );

  const fuse = useMemo(
    () =>
      new Fuse(corpus, {
        keys: [
          { name: 'title', weight: 3 },
          { name: 'summary', weight: 2 },
          { name: 'tags', weight: 2 },
          { name: 'body', weight: 1 },
        ],
        threshold: 0.4,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    [corpus],
  );

  const results = useMemo(() => {
    if (!debouncedQuery) return articles;
    const matches = fuse.search(debouncedQuery);
    const matchedSlugs = new Set(matches.map((m) => m.item.slug));
    return articles.filter((a) => matchedSlugs.has(a.slug));
  }, [debouncedQuery, fuse, articles]);

  return (
    <main className="container space-y-8 py-10">
      <header className="space-y-3">
        <h1 className="text-fg text-4xl font-bold tracking-tight">{T.title}</h1>
        <p className="text-fg-muted max-w-2xl text-base leading-relaxed">{T.subtitle}</p>
      </header>

      <section aria-label={T.searchAria} className="relative max-w-2xl">
        <Search
          aria-hidden="true"
          className="text-fg-muted pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={T.searchPlaceholder}
          className="border-border bg-bg-elevated text-fg focus:ring-fg/30 w-full rounded-xl border py-3 pe-4 ps-11 text-base focus:outline-none focus:ring-2"
          autoComplete="off"
        />
      </section>

      <section aria-live="polite" aria-label={T.resultsAria}>
        {results.length === 0 && <p className="text-fg-muted text-sm">{T.empty(debouncedQuery)}</p>}
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/${locale}/help/${a.slug}`}
                className="border-border bg-bg-elevated hover:bg-bg-muted group block h-full rounded-2xl border p-5 transition-colors"
              >
                <h2 className="text-fg text-lg font-semibold leading-snug" dir="auto">
                  {a.title}
                </h2>
                <p className="text-fg-muted mt-2 text-sm leading-relaxed" dir="auto">
                  {a.summary}
                </p>
                <p className="text-fg-subtle mt-3 inline-flex items-center gap-1 text-xs">
                  {T.read}
                  <ArrowRight
                    aria-hidden="true"
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
                  />
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

const LABELS = {
  en: {
    title: 'Help center',
    subtitle:
      'Guides for caregivers, therapists, and school staff. Search by keyword or browse the topics below.',
    searchAria: 'Search help articles',
    searchPlaceholder: 'Search articles…',
    resultsAria: 'Article results',
    empty: (q: string) => (q ? `No articles match "${q}". Try a broader search.` : 'No articles.'),
    read: 'Read article',
  },
  ar: {
    title: 'مركز المساعدة',
    subtitle:
      'أدلة لمقدّمي الرعاية والمعالجين وطاقم المدرسة. ابحث بكلمة مفتاحية أو تصفّح المواضيع أدناه.',
    searchAria: 'البحث في مقالات المساعدة',
    searchPlaceholder: 'ابحث في المقالات…',
    resultsAria: 'نتائج المقالات',
    empty: (q: string) =>
      q ? `لا توجد مقالات مطابقة لـ"${q}". جرّب بحثًا أوسع.` : 'لا توجد مقالات.',
    read: 'اقرأ المقال',
  },
} as const;
