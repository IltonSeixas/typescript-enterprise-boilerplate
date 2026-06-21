import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import { AuditEvent } from '../../domain/entities/audit-event.entity.js';
import { UserNotFoundError } from '../../domain/errors/domain.errors.js';
import type { UserRepository } from '../../domain/repositories/user.repository.js';
import { UserId } from '../../domain/value-objects/user-id.vo.js';
import { UserOutputDto } from '../dtos/auth-output.dto.js';
import { ChangeRoleDto } from '../dtos/change-role.dto.js';
import type { AuditPort } from '../ports/audit.port.js';
import { toUserOutput } from './register-user.use-case.js';

@injectable()
export class ChangeRoleUseCase {
  constructor(
    @inject('UserRepository') private readonly users: UserRepository,
    @inject('AuditPort') private readonly audit: AuditPort,
  ) {}

  async execute(actorId: string, targetId: string, input: ChangeRoleDto): Promise<UserOutputDto> {
    const actor = await this.users.findById(UserId.create(actorId));
    if (actor === null) {
      throw new UserNotFoundError();
    }

    const target = await this.users.findById(UserId.create(targetId));
    if (target === null) {
      throw new UserNotFoundError();
    }

    const previousRole = target.role;

    const updated = target.changeRole(input.role, actor);
    await this.users.update(updated);

    await this.audit.record(
      AuditEvent.create({
        eventType: 'role_changed',
        actorId,
        targetId,
        detail: `role changed from ${previousRole} to ${updated.role}`,
      }),
    );

    return toUserOutput(updated);
  }
}
