import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import { AuditEvent } from '../../domain/entities/audit-event.entity.js';
import { User } from '../../domain/entities/user.entity.js';
import { EmailAlreadyExistsError } from '../../domain/errors/domain.errors.js';
import type { UserRepository } from '../../domain/repositories/user.repository.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { PasswordHash } from '../../domain/value-objects/password-hash.vo.js';
import { RegisterUserDto } from '../dtos/register-user.dto.js';
import type { AuditPort } from '../ports/audit.port.js';
import type { PasswordHasherPort } from '../ports/password-hasher.port.js';
import { UserOutputDto } from '../dtos/auth-output.dto.js';

@injectable()
export class RegisterUserUseCase {
  constructor(
    @inject('UserRepository') private readonly users: UserRepository,
    @inject('PasswordHasher') private readonly hasher: PasswordHasherPort,
    @inject('AuditPort') private readonly audit: AuditPort,
  ) {}

  async execute(input: RegisterUserDto): Promise<UserOutputDto> {
    const email = Email.create(input.email);
    const existing = await this.users.findByEmail(email);
    if (existing !== null) {
      throw new EmailAlreadyExistsError(email.toString());
    }

    const ownerExists = await this.users.hasOwner();
    const role = ownerExists ? 'member' : 'owner';

    const hash = await this.hasher.hash(input.password);
    const user = User.create({
      name: input.name,
      email,
      passwordHash: PasswordHash.fromHash(hash),
      role,
    });

    if (role === 'owner') {
      await this.users.saveFirstOwner(user);
    } else {
      await this.users.save(user);
    }

    await this.audit.record(
      AuditEvent.create({
        eventType: 'user_registered',
        actorId: user.id.toString(),
        detail: `user registered with role ${user.role}`,
      }),
    );

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
