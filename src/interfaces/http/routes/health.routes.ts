import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { RedisStore } from '../../../infrastructure/cache/redis-store.js';

interface HealthRoutesOpts {
  redisStore: RedisStore;
  database: PostgresJsDatabase | undefined;
}

export function healthRoutes(app: FastifyInstance, opts: HealthRoutesOpts): void {
  app.get('/health', { config: { public: true } }, (_request, reply) => {
    return reply.status(200).send({ status: 'ok' });
  });

  app.get('/ready', { config: { public: true } }, async (_request, reply) => {
    const checks: Record<string, 'ok' | 'error'> = {};

    try {
      await opts.redisStore.ping();
      checks['redis'] = 'ok';
    } catch {
      checks['redis'] = 'error';
    }

    if (opts.database) {
      try {
        await opts.database.execute(sql`select 1`);
        checks['postgres'] = 'ok';
      } catch {
        checks['postgres'] = 'error';
      }
    }

    const isReady = Object.values(checks).every((status) => status === 'ok');
    return reply.status(isReady ? 200 : 503).send({ status: isReady ? 'ready' : 'not_ready', checks });
  });
}
