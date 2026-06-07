import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import { User } from '../../domain/entities/user.entity.js';
import {
  EmailAlreadyExistsError,
  OwnerAlreadyExistsError,
} from '../../domain/errors/domain.errors.js';
import type { UserRepository } from '../../domain/repositories/user.repository.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { PasswordHash } from '../../domain/value-objects/password-hash.vo.js';
import { RegisterUserDto } from '../dtos/register-user.dto.js';
import type { PasswordHasherPort } from '../ports/password-hasher.port.js';
import { UserOutputDto } from '../dtos/auth-output.dto.js';

@injectable()
export class RegisterUserUseCase {
  constructor(
    @inject('UserRepository') private readonly users: UserRepository,
    @inject('PasswordHasher') private readonly hasher: PasswordHasherPort,
  ) {}

  async execute(
    input: RegisterUserDto,
    asOwner = false,
  ): Promise<UserOutputDto> {
    const email = Email.create(input.email);
    const existing = await this.users.findByEmail(email);
    if (existing !== null) {
      throw new EmailAlreadyExistsError(email.toString());
    }

    if (asOwner) {
      const ownerExists = await this.users.hasOwner();
      if (ownerExists) {
        throw new OwnerAlreadyExistsError();
      }
    }

    const hash = await this.hasher.hash(input.password);
    const user = User.create({
      name: input.name,
      email,
      passwordHash: PasswordHash.fromHash(hash),
      role: asOwner ? 'owner' : 'member',
    });

    if (asOwner) {
      await this.users.saveFirstOwner(user);
    } else {
      await this.users.save(user);
    }

    return toUserOutput(user);
  }
}

export function toUserOutput(user: User): UserOutputDto {
  return {
    id: user.id.toString(),
    name: user.name,
    email: user.email.toString(),
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
