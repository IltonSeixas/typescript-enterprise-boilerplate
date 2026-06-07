import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import {
  InvalidCredentialsError,
  UserNotFoundError,
} from '../../domain/errors/domain.errors.js';
import type { UserRepository } from '../../domain/repositories/user.repository.js';
import { UserId } from '../../domain/value-objects/user-id.vo.js';
import { PasswordHash } from '../../domain/value-objects/password-hash.vo.js';
import { ChangePasswordDto } from '../dtos/change-password.dto.js';
import type { PasswordHasherPort } from '../ports/password-hasher.port.js';

@injectable()
export class ChangePasswordUseCase {
  constructor(
    @inject('UserRepository') private readonly users: UserRepository,
    @inject('PasswordHasher') private readonly hasher: PasswordHasherPort,
  ) {}

  async execute(userId: string, input: ChangePasswordDto): Promise<void> {
    const user = await this.users.findById(UserId.create(userId));
    if (user === null) {
      throw new UserNotFoundError();
    }

    const valid = await this.hasher.verify(
      user.passwordHash.toString(),
      input.currentPassword,
    );
    if (!valid) {
      throw new InvalidCredentialsError();
    }

    const newHash = await this.hasher.hash(input.newPassword);
    const updated = user.changePasswordHash(PasswordHash.fromHash(newHash));
    await this.users.update(updated);
  }
}
