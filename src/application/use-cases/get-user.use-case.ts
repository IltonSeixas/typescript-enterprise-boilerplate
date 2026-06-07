import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import {
  ForbiddenError,
  UserNotFoundError,
} from '../../domain/errors/domain.errors.js';
import type { UserRepository } from '../../domain/repositories/user.repository.js';
import { UserId } from '../../domain/value-objects/user-id.vo.js';
import { UserOutputDto } from '../dtos/auth-output.dto.js';
import { toUserOutput } from './register-user.use-case.js';

@injectable()
export class GetUserUseCase {
  constructor(
    @inject('UserRepository') private readonly users: UserRepository,
  ) {}

  async execute(requesterId: string, targetId: string): Promise<UserOutputDto> {
    if (requesterId !== targetId) {
      const requester = await this.users.findById(UserId.create(requesterId));
      if (requester === null || !requester.canManageRoles()) {
        throw new ForbiddenError();
      }
    }

    const user = await this.users.findById(UserId.create(targetId));
    if (user === null) {
      throw new UserNotFoundError();
    }

    return toUserOutput(user);
  }
}
