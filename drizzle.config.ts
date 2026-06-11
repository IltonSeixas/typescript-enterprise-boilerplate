import type { Config } from 'drizzle-kit';

export default {
  schema: './src/infrastructure/persistence/postgres/schema.ts',
  out: './src/infrastructure/persistence/postgres/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgres://boilerplate:boilerplate@localhost:5432/boilerplate',
  },
} satisfies Config;
