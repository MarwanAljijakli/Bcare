/**
 * Help-article content types — Module 8.
 *
 * Articles are authored as structured TypeScript data, not Markdown:
 *   • No runtime parser / sanitizer needed — every paragraph + heading
 *     is a string we author in this repo. No untrusted HTML enters the
 *     render pipeline.
 *   • TOC generation is trivial (walk `sections[].heading`).
 *   • Full type-checking on EN ↔ AR parity (the parity assertion in
 *     `index.ts` ensures every slug has both locales filled in).
 *
 * Adding a new article: create a row in `EN_ARTICLES` AND `AR_ARTICLES`
 * with the SAME slug. The lint pass at module-load time will throw if
 * a slug exists in only one locale, so omissions surface during dev
 * rather than at runtime.
 */

export interface HelpSection {
  /** H2 heading. Used for TOC anchor + scroll target. Should be unique
   *  within a single article. */
  heading: string;
  /** Body paragraphs. Each renders as one <p>. */
  paragraphs: string[];
  /** Optional bullet list rendered after the paragraphs. */
  list?: string[];
}

export interface HelpArticle {
  /** URL slug, kebab-case. Stable; never rename. */
  slug: string;
  /** EN or AR. Same slug appears in both locales. */
  locale: 'en' | 'ar';
  /** Page <h1>. */
  title: string;
  /** One-line summary shown in the help index card + the article lead. */
  summary: string;
  /** ISO date string `YYYY-MM-DD`. Shown as "Last updated". */
  updatedAt: string;
  /** Hashtag-style tags for Fuse search weighting. */
  tags: string[];
  /** First body paragraph. Renders above the TOC. */
  lead: string;
  /** Body sections in document order. */
  sections: HelpSection[];
}
