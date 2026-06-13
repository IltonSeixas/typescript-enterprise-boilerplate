import type { FastifyInstance } from 'fastify';
import { GetUserUseCase } from '../../../application/use-cases/get-user.use-case.js';
import { UpdateProfileUseCase } from '../../../application/use-cases/update-profile.use-case.js';
import { ChangePasswordUseCase } from '../../../application/use-cases/change-password.use-case.js';
import { ChangeRoleUseCase } from '../../../application/use-cases/change-role.use-case.js';
import { UpdateProfileSchema } from '../../../application/dtos/update-profile.dto.js';
import { ChangePasswordSchema } from '../../../application/dtos/change-password.dto.js';
import { ChangeRoleSchema } from '../../../application/dtos/change-role.dto.js';
import {
  ForbiddenError,
  InsufficientPermissionsError,
  InvalidCredentialsError,
  UserNotFoundError,
} from '../../../domain/errors/domain.errors.js';
import { domainError, formatZodError } from '../http-errors.js';

interface UserRoutesOpts {
  getUser: GetUserUseCase;
  updateProfile: UpdateProfileUseCase;
  changePassword: ChangePasswordUseCase;
  changeRole: ChangeRoleUseCase;
}

export function userRoutes(app: FastifyInstance, opts: UserRoutesOpts): void {
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

  app.put('/:id/role', async (request, reply) => {
    const { id } = request.params as { id: string };

    const parsed = ChangeRoleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(formatZodError(parsed.error));
    }

    try {
      const user = await opts.changeRole.execute(request.auth.id, id, parsed.data);
      return reply.status(200).send(user);
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        return reply.status(404).send(domainError(err));
      }
      if (err instanceof InsufficientPermissionsError) {
        return reply.status(403).send(domainError(err));
      }
      throw err;
    }
  });
}
