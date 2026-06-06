import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import { UserNotFoundError } from '../../domain/errors/domain.errors.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';
import { UserId } from '../../domain/value-objects/user-id.vo.js';
import { UserOutputDto } from '../dtos/auth-output.dto.js';
import { UpdateProfileDto } from '../dtos/update-profile.dto.js';
import { toUserOutput } from './register-user.use-case.js';

@injectable()
export class UpdateProfileUseCase {
  constructor(
    @inject('UserRepository') private readonly users: UserRepository,
  ) {}

  async execute(userId: string, input: UpdateProfileDto): Promise<UserOutputDto> {
    const user = await this.users.findById(UserId.create(userId));
    if (user === null) {
      throw new UserNotFoundError();
    }

    const updated = user.updateProfile(input.name);
    await this.users.update(updated);

    return toUserOutput(updated);
  }
}
