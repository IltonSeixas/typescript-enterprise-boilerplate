import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'bun:test';
import { RegisterUserUseCase } from '../register-user.use-case.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import type { AuditEvent } from '../../../domain/entities/audit-event.entity.js';
import type { AuditPort } from '../../ports/audit.port.js';
import type { PasswordHasherPort } from '../../ports/password-hasher.port.js';
import { EmailAlreadyExistsError } from '../../../domain/errors/domain.errors.js';
import { User } from '../../../domain/entities/user.entity.js';
import { Email } from '../../../domain/value-objects/email.vo.js';
import { PasswordHash } from '../../../domain/value-objects/password-hash.vo.js';
import { UserId } from '../../../domain/value-objects/user-id.vo.js';

const makeUserRepo = (overrides?: Partial<UserRepository>): UserRepository => ({
  findById: async () => null,
  findByEmail: async () => null,
  save: async () => {},
  update: async () => {},
  saveFirstOwner: async () => {},
  hasOwner: async () => true,
  ...overrides,
});

const makeHasher = (): PasswordHasherPort => ({
  hash: async (plain: string) => `$argon2id$${plain}`,
  verify: async (hash: string, plain: string) => hash === `$argon2id$${plain}`,
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

const makeExistingUser = (): User =>
  User.reconstitute({
    id: UserId.create('00000000-0000-0000-0000-000000000001'),
    name: 'Existing User',
    email: Email.create('existing@example.com'),
    passwordHash: PasswordHash.fromHash('$argon2id$password'),
    role: 'member',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

describe('RegisterUserUseCase', () => {
  let hasher: PasswordHasherPort;
  let audit: ReturnType<typeof makeAuditPort>;

  beforeEach(() => {
    hasher = makeHasher();
    audit = makeAuditPort();
  });

  it('registers a member when an owner already exists', async () => {
    const repo = makeUserRepo();
    const useCase = new RegisterUserUseCase(repo, hasher, audit);

    const result = await useCase.execute({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'strongpassword123',
    });

    expect(result.name).toBe('Alice');
    expect(result.email).toBe('alice@example.com');
    expect(result.role).toBe('member');
    expect(result.isActive).toBe(true);
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]?.eventType).toBe('user_registered');
  });

  it('throws EmailAlreadyExistsError when email is taken', async () => {
    const existing = makeExistingUser();
    const repo = makeUserRepo({
      findByEmail: async () => existing,
    });
    const useCase = new RegisterUserUseCase(repo, hasher, audit);

    await expect(
      useCase.execute({
        name: 'Bob',
        email: 'existing@example.com',
        password: 'strongpassword123',
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
  });

  it('claims owner role when no owner exists', async () => {
    let savedUser: User | null = null;
    const repo = makeUserRepo({
      hasOwner: async () => false,
      saveFirstOwner: async (user: User) => {
        savedUser = user;
      },
    });
    const useCase = new RegisterUserUseCase(repo, hasher, audit);

    const result = await useCase.execute({
      name: 'First User',
      email: 'owner@example.com',
      password: 'strongpassword123',
    });

    expect(result.role).toBe('owner');
    expect(savedUser).not.toBeNull();
  });

  it('registers as member when owner slot is taken', async () => {
    let savedAsMember: User | null = null;
    const repo = makeUserRepo({
      hasOwner: async () => true,
      save: async (user: User) => {
        savedAsMember = user;
      },
    });
    const useCase = new RegisterUserUseCase(repo, hasher, audit);

    const result = await useCase.execute({
      name: 'Second User',
      email: 'member@example.com',
      password: 'strongpassword123',
    });

    expect(result.role).toBe('member');
    expect(savedAsMember).not.toBeNull();
  });
});
