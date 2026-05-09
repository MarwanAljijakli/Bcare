import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['*.ts', 'schemas/**/*.ts', 'types/**/*.ts'],
      exclude: ['**/*.{test,spec}.ts', '**/*.d.ts', 'index.ts'],
      thresholds: { lines: 80, statements: 80, functions: 75, branches: 70 },
    },
  },
});
