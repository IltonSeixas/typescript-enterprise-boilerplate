import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const MIGRATIONS_FOLDER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'migrations',
);

export interface PostgresPoolOptions {
  max: number;
  idleTimeoutSeconds: number;
  connectTimeoutSeconds: number;
  maxLifetimeSeconds: number;
}

export async function createPostgresDatabase(
  databaseUrl: string,
  poolOptions: PostgresPoolOptions,
): Promise<PostgresJsDatabase> {
  const client = postgres(databaseUrl, {
    max: poolOptions.max,
    idle_timeout: poolOptions.idleTimeoutSeconds,
    connect_timeout: poolOptions.connectTimeoutSeconds,
    max_lifetime: poolOptions.maxLifetimeSeconds,
  });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}
