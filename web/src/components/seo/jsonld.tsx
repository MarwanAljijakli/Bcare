import type { AppLocale } from '@/i18n/routing';
import { SITE } from '@/lib/seo';

// Server component. Renders <script type="application/ld+json"> tags. Each
// helper covers one schema.org type so we can compose only what each page needs.

function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // Stringification is intentional — the schema must be a literal JSON
      // string in the DOM. Content is fully controlled by us; no XSS surface.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function OrganizationJsonLd({ locale }: { locale: AppLocale }) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: SITE.name[locale],
        url: SITE.baseUrl,
        logo: `${SITE.baseUrl}/brand/logo-mark.svg`,
        description: SITE.defaultDescription[locale],
        founder: [
          { '@type': 'Person', name: 'Somaya Nather Dayan' },
          { '@type': 'Person', name: 'Masa Malik Alalawi' },
          { '@type': 'Person', name: 'Alaa Khalid Al-Ghamdi' },
          { '@type': 'Person', name: 'Fadwa Ibrahim Abushanab' },
        ],
        parentOrganization: {
          '@type': 'CollegeOrUniversity',
          name: 'Jeddah International College',
        },
      }}
    />
  );
}

export function WebsiteJsonLd({ locale }: { locale: AppLocale }) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE.name[locale],
        url: `${SITE.baseUrl}/${locale}`,
        inLanguage: locale === 'ar' ? 'ar-SA' : 'en',
      }}
    />
  );
}

export function ProductJsonLd({ locale }: { locale: AppLocale }) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: SITE.name[locale],
        applicationCategory: 'HealthApplication',
        operatingSystem: 'Any',
        description: SITE.defaultDescription[locale],
        url: SITE.baseUrl,
        // Pricing is announced at launch; we intentionally do NOT publish a
        // misleading "free" price here.
        offers: {
          '@type': 'Offer',
          availability: 'https://schema.org/PreOrder',
          url: `${SITE.baseUrl}/${locale}/pricing`,
        },
      }}
    />
  );
}

export function FaqJsonLd({
  questions,
}: {
  questions: Array<{ question: string; answer: string }>;
}) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: questions.map((q) => ({
          '@type': 'Question',
          name: q.question,
          acceptedAnswer: { '@type': 'Answer', text: q.answer },
        })),
      }}
    />
  );
}
