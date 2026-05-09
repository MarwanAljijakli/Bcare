import { withThemeByDataAttribute } from '@storybook/addon-themes';
import { NextIntlClientProvider } from 'next-intl';
import ar from '../messages/ar.json';
import en from '../messages/en.json';
import type { Preview } from '@storybook/react';
import '../app/globals.css';

const preview: Preview = {
  parameters: {
    controls: { expanded: true, matchers: { color: /(background|color)$/i, date: /Date$/ } },
    options: {
      storySort: { order: ['Foundations', 'Components', 'Patterns', 'Surfaces'] },
    },
    a11y: {
      element: '#storybook-root',
      config: {
        rules: [
          // We enforce AAA on the child surface; stories tagged `surface=child`
          // can opt into stricter rules via the rule-tag system below.
        ],
      },
    },
  },
  globalTypes: {
    locale: {
      description: 'Locale for next-intl provider (also flips dir attribute)',
      defaultValue: 'en',
      toolbar: {
        title: 'Locale',
        icon: 'globe',
        items: [
          { value: 'en', title: 'English (LTR)' },
          { value: 'ar', title: 'العربية (RTL)' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    withThemeByDataAttribute({
      themes: { light: 'light', dark: 'dark', 'high-contrast': 'hc' },
      defaultTheme: 'light',
      attributeName: 'data-theme',
    }),
    (Story, ctx) => {
      const locale = (ctx.globals.locale as 'en' | 'ar') ?? 'en';
      const messages = locale === 'ar' ? ar : en;
      const dir = locale === 'ar' ? 'rtl' : 'ltr';
      // Set dir on the storybook iframe root for layout-direction stories.
      if (typeof document !== 'undefined') {
        document.documentElement.dir = dir;
        document.documentElement.lang = locale;
      }
      return (
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Story />
        </NextIntlClientProvider>
      );
    },
  ],
};

export default preview;
