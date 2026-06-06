import type { FastifyInstance } from 'fastify';
import { z, ZodError } from 'zod';
import { GetUserUseCase } from '../../../application/use-cases/get-user.use-case.js';
import { UpdateProfileUseCase } from '../../../application/use-cases/update-profile.use-case.js';
import { ChangePasswordUseCase } from '../../../application/use-cases/change-password.use-case.js';
import {
  ForbiddenError,
  InvalidCredentialsError,
  UserNotFoundError,
} from '../../../domain/errors/domain.errors.js';

const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
});

interface UserRoutesOpts {
  getUser: GetUserUseCase;
  updateProfile: UpdateProfileUseCase;
  changePassword: ChangePasswordUseCase;
}

export async function userRoutes(
  app: FastifyInstance,
  opts: UserRoutesOpts,
): Promise<void> {
  app.get('/me', async (request, reply) => {
    const requesterId = request.auth.id;

    try {
      const user = await opts.getUser.execute(requesterId, requesterId);
      return reply.status(200).send(user);
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        return reply.status(404).send(domainError(err));
      }
      if (err instanceof ForbiddenError) {
        return reply.status(403).send(domainError(err));
      }
      throw err;
    }
  });

  app.put('/me', async (request, reply) => {
    const parsed = UpdateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(formatZodError(parsed.error));
    }

    try {
      const user = await opts.updateProfile.execute(request.auth.id, parsed.data);
      return reply.status(200).send(user);
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        return reply.status(404).send(domainError(err));
      }
      throw err;
    }
  });

  app.put('/me/password', async (request, reply) => {
    const parsed = ChangePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(formatZodError(parsed.error));
    }

    try {
      await opts.changePassword.execute(request.auth.id, parsed.data);
      return reply.status(204).send();
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        return reply.status(404).send(domainError(err));
      }
      if (err instanceof InvalidCredentialsError) {
        return reply.status(401).send(domainError(err));
      }
      throw err;
    }
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const user = await opts.getUser.execute(request.auth.id, id);
      return reply.status(200).send(user);
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        return reply.status(404).send(domainError(err));
      }
      if (err instanceof ForbiddenError) {
        return reply.status(403).send(domainError(err));
      }
      throw err;
    }
  });
}

function formatZodError(err: ZodError): object {
  return {
    statusCode: 400,
    error: 'Bad Request',
    message: 'Validation failed',
    details: err.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    })),
  };
}

function domainError(err: { code: string; message: string }): object {
  return {
    statusCode: undefined,
    error: err.code,
    message: err.message,
  };
}
