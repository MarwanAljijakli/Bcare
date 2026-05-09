import { type ReactNode } from 'react';

/**
 * Shared legal-page shell. Used by /privacy, /terms, and /accessibility.
 * Provides a constrained reading column, a "last updated" line, and a
 * sectioned body. Each section is rendered as a heading + paragraph pair.
 */
export function LegalPage({
  title,
  lastUpdated,
  intro,
  sections,
}: {
  title: string;
  lastUpdated: string;
  intro: ReactNode;
  sections: Array<{ id: string; title: string; body: ReactNode }>;
}) {
  return (
    <article className="container py-16 md:py-24">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-fg text-balance text-4xl font-bold leading-tight tracking-tight md:text-5xl">
          {title}
        </h1>
        <p className="text-fg-subtle mt-3 text-sm">{lastUpdated}</p>
        <p className="text-fg-muted mt-6 text-base leading-relaxed">{intro}</p>

        <div className="mt-10 space-y-10">
          {sections.map((s) => (
            <section key={s.id} aria-labelledby={`s-${s.id}`}>
              <h2 id={`s-${s.id}`} className="text-fg text-xl font-bold tracking-tight md:text-2xl">
                {s.title}
              </h2>
              <div className="text-fg-muted mt-3 text-base leading-relaxed">{s.body}</div>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
