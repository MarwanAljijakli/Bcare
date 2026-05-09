import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

/**
 * next-intl request config. Loads the message catalog for the matched locale.
 * Catalogs live at `web/messages/{locale}.json` and are split into namespaces
 * by surface (`marketing.*`, `auth.*`, `board.*`, `dashboard.*`, `common.*`).
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = routing.locales.includes(requested as never)
    ? (requested as (typeof routing.locales)[number])
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: 'Asia/Riyadh',
    now: new Date(),
    formats: {
      dateTime: {
        short: { dateStyle: 'short' },
        long: { dateStyle: 'long', timeStyle: 'short' },
      },
      number: {
        percent: { style: 'percent', maximumFractionDigits: 0 },
      },
    },
  };
});
