import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const MIGRATIONS_FOLDER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'migrations',
);

// Arbitrary but fixed so every replica targets the same advisory lock.
const MIGRATION_LOCK_KEY = 72147483647;

export interface PostgresPoolOptions {
  max: number;
  idleTimeoutSeconds: number;
  connectTimeoutSeconds: number;
  maxLifetimeSeconds: number;
}

// Drizzle's migrator only wraps statements in a transaction, which does not
// prevent concurrent replicas from racing on the migrations tracking table.
// postgres-js reserved connections don't support transactions, so the lock
// is held on a separate dedicated connection for the duration of the run
// instead of on the same session that executes the migration.
async function runMigrations(databaseUrl: string): Promise<void> {
  const lockClient = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await lockClient.unsafe(`SELECT pg_advisory_lock(${MIGRATION_LOCK_KEY})`);
    try {
      const migrateClient = postgres(databaseUrl, { max: 1, onnotice: () => {} });
      try {
        await migrate(drizzle(migrateClient), { migrationsFolder: MIGRATIONS_FOLDER });
      } finally {
        await migrateClient.end();
      }
    } finally {
      await lockClient.unsafe(`SELECT pg_advisory_unlock(${MIGRATION_LOCK_KEY})`);
    }
  } finally {
    await lockClient.end();
  }
}

export async function createPostgresDatabase(
  databaseUrl: string,
  poolOptions: PostgresPoolOptions,
): Promise<PostgresJsDatabase> {
  await runMigrations(databaseUrl);
  const client = postgres(databaseUrl, {
    max: poolOptions.max,
    idle_timeout: poolOptions.idleTimeoutSeconds,
    connect_timeout: poolOptions.connectTimeoutSeconds,
    max_lifetime: poolOptions.maxLifetimeSeconds,
  });
  return drizzle(client);
}
