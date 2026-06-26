import { describe, it, expect, afterAll } from 'bun:test';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import postgres from 'postgres';
import { createPostgresDatabase } from './connection.js';

const CONCURRENT_REPLICAS = 8;

describe('createPostgresDatabase concurrent migrations', () => {
  let container: StartedPostgreSqlContainer;

  afterAll(async () => {
    await container?.stop();
  });

  it('applies migrations exactly once when multiple replicas start concurrently', async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    const databaseUrl = container.getConnectionUri();

    const poolOptions = {
      max: 5,
      idleTimeoutSeconds: 30,
      connectTimeoutSeconds: 10,
      maxLifetimeSeconds: 60,
    };

    // Each simulated replica gets its own database client, mirroring how
    // independent app instances would each open their own connection in
    // production.
    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENT_REPLICAS }, () =>
        createPostgresDatabase(databaseUrl, poolOptions),
      ),
    );

    const failures = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(failures.map((failure) => failure.reason)).toEqual([]);

    const verifyClient = postgres(databaseUrl, { max: 1 });
    try {
      const usersTables = await verifyClient`
        SELECT count(*)::int AS count FROM information_schema.tables WHERE table_name = 'users'
      `;
      expect(usersTables[0]?.count).toBe(1);

      const auditTables = await verifyClient`
        SELECT count(*)::int AS count FROM information_schema.tables WHERE table_name = 'audit_log'
      `;
      expect(auditTables[0]?.count).toBe(1);
    } finally {
      await verifyClient.end();
    }
  }, 60_000);
});
