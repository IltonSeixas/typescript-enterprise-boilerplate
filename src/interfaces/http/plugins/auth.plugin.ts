import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import { UserId } from '../../../domain/value-objects/user-id.vo.js';
import type { TokenServicePort } from '../../../application/ports/token-service.port.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth: {
      id: string;
    };
  }
}

interface AuthPluginOptions {
  userRepository: UserRepository;
  tokenService: TokenServicePort;
}

export const authPlugin = fp(
  (app: FastifyInstance, opts: AuthPluginOptions) => {
    app.decorateRequest('auth', null, []);

    app.addHook('preHandler', async (request: FastifyRequest, reply) => {
      const routeConfig = request.routeOptions.config as unknown as Record<string, unknown> | undefined;
      if (routeConfig?.['public'] === true) {
        return;
      }

      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        await reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Missing or invalid authorization header',
        });
        return;
      }

      const token = authHeader.slice(7);
      let payload: { sub: string; jti: string };
      try {
        payload = opts.tokenService.verifyAccessToken(token);
      } catch {
        await reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid or expired token',
        });
        return;
      }

      const user = await opts.userRepository.findById(
        UserId.create(payload.sub),
      );
      if (user === null || !user.isActive) {
        await reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'User not found or inactive',
        });
        return;
      }

      request.auth = { id: payload.sub };
    });
  },
);
