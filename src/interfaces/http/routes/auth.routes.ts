import type { FastifyInstance } from 'fastify';
import { LoginUserUseCase } from '../../../application/use-cases/login-user.use-case.js';
import { LogoutUserUseCase } from '../../../application/use-cases/logout-user.use-case.js';
import { RefreshTokenUseCase } from '../../../application/use-cases/refresh-token.use-case.js';
import { RegisterUserUseCase } from '../../../application/use-cases/register-user.use-case.js';
import {
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  OwnerAlreadyExistsError,
  UserInactiveError,
} from '../../../domain/errors/domain.errors.js';
import {
  LoginUserSchema,
} from '../../../application/dtos/login-user.dto.js';
import {
  RegisterUserSchema,
} from '../../../application/dtos/register-user.dto.js';
import { domainError, formatZodError } from '../http-errors.js';

const COOKIE_NAME = 'refresh_token';

const AUTH_RATE_LIMIT = { max: 10, timeWindow: 60000 };

interface AuthRoutesOpts {
  registerUser: RegisterUserUseCase;
  loginUser: LoginUserUseCase;
  refreshToken: RefreshTokenUseCase;
  logoutUser: LogoutUserUseCase;
}

export function authRoutes(app: FastifyInstance, opts: AuthRoutesOpts): void {
  app.post(
    '/register',
    { config: { public: true, rateLimit: AUTH_RATE_LIMIT } },
    async (request, reply) => {
      const parsed = RegisterUserSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(formatZodError(parsed.error));
      }

      try {
        const user = await opts.registerUser.execute(parsed.data);
        return reply.status(201).send(user);
      } catch (err) {
        if (err instanceof EmailAlreadyExistsError) {
          return reply.status(409).send(domainError(err));
        }
        if (err instanceof OwnerAlreadyExistsError) {
          return reply.status(409).send(domainError(err));
        }
        throw err;
      }
    },
  );

  app.post(
    '/login',
    { config: { public: true, rateLimit: AUTH_RATE_LIMIT } },
    async (request, reply) => {
      const parsed = LoginUserSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(formatZodError(parsed.error));
      }

      try {
        const result = await opts.loginUser.execute(parsed.data);
        const { refreshToken, ...output } = result;

        void reply.setCookie(COOKIE_NAME, refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          path: '/api/v1/auth',
          maxAge: 604800,
        });

        return reply.status(200).send(output);
      } catch (err) {
        if (
          err instanceof InvalidCredentialsError ||
          err instanceof UserInactiveError
        ) {
          return reply.status(401).send(domainError(err));
        }
        throw err;
      }
    },
  );

  app.post(
    '/refresh',
    { config: { public: true, rateLimit: AUTH_RATE_LIMIT } },
    async (request, reply) => {
      const token = request.cookies[COOKIE_NAME];
      if (!token) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Refresh token missing',
        });
      }

      try {
        const result = await opts.refreshToken.execute(token);
        const { refreshToken, ...output } = result;

        void reply.setCookie(COOKIE_NAME, refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          path: '/api/v1/auth',
          maxAge: 604800,
        });

        return reply.status(200).send(output);
      } catch (err) {
        if (err instanceof InvalidRefreshTokenError) {
          return reply.status(401).send(domainError(err));
        }
        throw err;
      }
    },
  );

  app.post(
    '/logout',
    { config: { public: true } },
    async (request, reply) => {
      const token = request.cookies[COOKIE_NAME];
      if (token) {
        await opts.logoutUser.execute(token);
      }

      void reply.clearCookie(COOKIE_NAME, { path: '/api/v1/auth' });
      return reply.status(204).send();
    },
  );
}
