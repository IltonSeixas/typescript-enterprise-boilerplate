import type { FastifyInstance } from 'fastify';
import { collectDefaultMetrics, register } from 'prom-client';

export function metricsRoutes(app: FastifyInstance): void {
  collectDefaultMetrics({ register });

  app.get('/metrics', { config: { public: true } }, async (_request, reply) => {
    return reply.status(200).header('Content-Type', register.contentType).send(await register.metrics());
  });
}
