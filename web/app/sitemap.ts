import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bluecare.app';

const PATHS = [
  '', // landing
  'how-it-works',
  'for-caregivers',
  'for-therapists',
  'about',
  'team',
  'security',
  'signup',
  'login',
  'privacy',
  'terms',
  'accessibility',
  'contact',
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PATHS.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: `${BASE_URL}/${locale}${path ? `/${path}` : ''}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: path === '' ? 1 : 0.7,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, `${BASE_URL}/${l}${path ? `/${path}` : ''}`]),
        ),
      },
    })),
  );
}
