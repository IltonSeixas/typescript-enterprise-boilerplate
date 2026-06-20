import 'reflect-metadata';
import { describe, it, expect } from 'bun:test';
import { ChangeRoleUseCase } from '../change-role.use-case.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import type { AuditEvent } from '../../../domain/entities/audit-event.entity.js';
import type { AuditPort } from '../../ports/audit.port.js';
import { InsufficientPermissionsError, UserNotFoundError } from '../../../domain/errors/domain.errors.js';
import { User, type UserRole } from '../../../domain/entities/user.entity.js';
import { Email } from '../../../domain/value-objects/email.vo.js';
import { PasswordHash } from '../../../domain/value-objects/password-hash.vo.js';
import { UserId } from '../../../domain/value-objects/user-id.vo.js';

const ACTOR_ID = '00000000-0000-0000-0000-000000000001';
const TARGET_ID = '00000000-0000-0000-0000-000000000002';

const makeUserRepo = (overrides?: Partial<UserRepository>): UserRepository => ({
  findById: async () => null,
  findByEmail: async () => null,
  save: async () => {},
  update: async () => {},
  saveFirstOwner: async () => {},
  hasOwner: async () => false,
  ...overrides,
});

const makeAuditPort = (): AuditPort & { events: AuditEvent[] } => {
  const events: AuditEvent[] = [];
  return {
    events,
    record: async (event: AuditEvent) => {
      events.push(event);
    },
  };
};

const userWithRole = (id: string, email: string, role: UserRole): User =>
  User.reconstitute({
    id: UserId.create(id),
    name: 'Test User',
    email: Email.create(email),
    passwordHash: PasswordHash.fromHash('$argon2id$password'),
    role,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

describe('ChangeRoleUseCase', () => {
  it('lança UserNotFoundError quando o ator não existe', async () => {
    const repo = makeUserRepo({
      findById: async () => null,
    });
    const useCase = new ChangeRoleUseCase(repo, makeAuditPort());

    await expect(
      useCase.execute(ACTOR_ID, TARGET_ID, { role: 'admin' }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it('lança UserNotFoundError quando o alvo não existe', async () => {
    const actor = userWithRole(ACTOR_ID, 'owner@example.com', 'owner');
    const repo = makeUserRepo({
      findById: async (id) => (id.toString() === ACTOR_ID ? actor : null),
    });
    const useCase = new ChangeRoleUseCase(repo, makeAuditPort());

    await expect(
      useCase.execute(ACTOR_ID, TARGET_ID, { role: 'admin' }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it('lança InsufficientPermissionsError quando o ator não tem permissão', async () => {
    const actor = userWithRole(ACTOR_ID, 'member@example.com', 'member');
    const target = userWithRole(TARGET_ID, 'target@example.com', 'member');
    const repo = makeUserRepo({
      findById: async (id) => {
        if (id.toString() === ACTOR_ID) return actor;
        if (id.toString() === TARGET_ID) return target;
        return null;
      },
    });
    const useCase = new ChangeRoleUseCase(repo, makeAuditPort());

    await expect(
      useCase.execute(ACTOR_ID, TARGET_ID, { role: 'admin' }),
    ).rejects.toBeInstanceOf(InsufficientPermissionsError);
  });

  it('lança InsufficientPermissionsError quando o ator tenta alterar o próprio papel', async () => {
    const owner = userWithRole(ACTOR_ID, 'owner@example.com', 'owner');
    const repo = makeUserRepo({
      findById: async (id) => (id.toString() === ACTOR_ID ? owner : null),
    });
    const useCase = new ChangeRoleUseCase(repo, makeAuditPort());

    await expect(
      useCase.execute(ACTOR_ID, ACTOR_ID, { role: 'admin' }),
    ).rejects.toBeInstanceOf(InsufficientPermissionsError);
  });

  it('owner promove member para admin e persiste a alteração', async () => {
    const actor = userWithRole(ACTOR_ID, 'owner@example.com', 'owner');
    const target = userWithRole(TARGET_ID, 'target@example.com', 'member');
    let updated: User | undefined;
    const repo = makeUserRepo({
      findById: async (id) => {
        if (id.toString() === ACTOR_ID) return actor;
        if (id.toString() === TARGET_ID) return target;
        return null;
      },
      update: async (user) => {
        updated = user;
      },
    });
    const audit = makeAuditPort();
    const useCase = new ChangeRoleUseCase(repo, audit);

    const result = await useCase.execute(ACTOR_ID, TARGET_ID, { role: 'admin' });

    expect(result.role).toBe('admin');
    expect(result.id).toBe(TARGET_ID);
    expect(updated?.role).toBe('admin');
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]?.eventType).toBe('role_changed');
    expect(audit.events[0]?.detail).toBe('role changed from member to admin');
  });
});
