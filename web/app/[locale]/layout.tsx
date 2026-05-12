import { Inter, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import type { Metadata, Viewport } from 'next';
import { QueryProvider } from '@/components/providers/query-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { SkipLink } from '@/components/skip-link';
import { routing, type AppLocale } from '@/i18n/routing';
import { cn } from '@/lib/cn';
import { directionForLocale } from '@/lib/direction';
import '../globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
  display: 'swap',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F9FAFB' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1220' },
  ],
  colorScheme: 'light dark',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
    title: {
      default: isAr ? 'بلوكير' : 'BlueCare',
      template: isAr ? '%s — بلوكير' : '%s — BlueCare',
    },
    description: isAr
      ? 'تواصل ذكي وشخصي للأطفال ذوي اضطراب طيف التوحد.'
      : 'Smart, personalized communication for children with autism.',
    applicationName: 'BlueCare',
    formatDetection: { telephone: false },
    alternates: {
      canonical: `/${locale}`,
      languages: {
        en: '/en',
        ar: '/ar',
        'x-default': '/en',
      },
    },
    robots: { index: true, follow: true },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as AppLocale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();
  const direction = directionForLocale(locale as AppLocale);

  return (
    <html
      lang={locale}
      dir={direction}
      suppressHydrationWarning
      className={cn(inter.variable, arabic.variable)}
    >
      <body className="bg-bg text-fg min-h-dvh antialiased">
        <ThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <QueryProvider>
              <SkipLink />
              {children}
            </QueryProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
