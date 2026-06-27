import type { FastifyInstance } from 'fastify';
import { collectDefaultMetrics, register } from 'prom-client';

interface MetricsRoutesOpts {
  metricsToken: string | undefined;
}

export function metricsRoutes(app: FastifyInstance, opts: MetricsRoutesOpts): void {
  collectDefaultMetrics({ register });

  app.get('/metrics', { config: { public: true } }, async (request, reply) => {
    if (opts.metricsToken !== undefined) {
      const authHeader = request.headers.authorization;
      if (authHeader !== `Bearer ${opts.metricsToken}`) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Missing or invalid authorization header',
        });
      }
    }

    return reply.status(200).header('Content-Type', register.contentType).send(await register.metrics());
  });
}
