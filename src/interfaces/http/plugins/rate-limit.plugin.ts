import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

interface RateLimitConfig {
  max: number;
  timeWindow: number;
}

export const rateLimitPlugin = fp(
  async (app: FastifyInstance, opts: RateLimitConfig) => {
    await app.register(rateLimit, {
      max: opts.max,
      timeWindow: opts.timeWindow,
      errorResponseBuilder: (_req, context) => ({
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
      }),
    });
  },
);
