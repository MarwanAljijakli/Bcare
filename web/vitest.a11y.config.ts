/// <reference types="vitest" />
import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config';

// A separate suite that runs only the *.a11y.test.tsx files. Lets CI surface
// accessibility regressions independently from unit failures.
export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ['src/**/*.a11y.{test,spec}.{ts,tsx}'],
      coverage: { enabled: false },
    },
  }),
);
