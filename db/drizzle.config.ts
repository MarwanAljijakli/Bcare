import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_URL;
if (!url) {
  // drizzle-kit reads this at CLI-time; throw early for clearer errors than the lib's default.
  throw new Error(
    'DATABASE_URL is required for drizzle-kit. See docs/deploy.md for the env-var checklist.',
  );
}

export default defineConfig({
  schema: './schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
