import 'reflect-metadata';
import { describe, it, expect } from 'bun:test';
import { ChangePasswordUseCase } from '../change-password.use-case.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import type { PasswordHasherPort } from '../../ports/password-hasher.port.js';
import {
  InvalidCredentialsError,
  UserNotFoundError,
} from '../../../domain/errors/domain.errors.js';
import { User } from '../../../domain/entities/user.entity.js';
import { Email } from '../../../domain/value-objects/email.vo.js';
import { PasswordHash } from '../../../domain/value-objects/password-hash.vo.js';
import { UserId } from '../../../domain/value-objects/user-id.vo.js';

const USER_ID = '00000000-0000-0000-0000-000000000001';

const makeUserRepo = (overrides?: Partial<UserRepository>): UserRepository => ({
  findById: async () => null,
  findByEmail: async () => null,
  save: async () => {},
  update: async () => {},
  saveFirstOwner: async () => {},
  hasOwner: async () => false,
  ...overrides,
});

const makeHasher = (): PasswordHasherPort => ({
  hash: async (plain: string) => `$argon2id$${plain}`,
  verify: async (hash: string, plain: string) => hash === `$argon2id$${plain}`,
});

const makeUser = (): User =>
  User.reconstitute({
    id: UserId.create(USER_ID),
    name: 'Alice',
    email: Email.create('alice@example.com'),
    passwordHash: PasswordHash.fromHash('$argon2id$current-password'),
    role: 'member',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

describe('ChangePasswordUseCase', () => {
  it('troca senha com sucesso', async () => {
    const user = makeUser();
    let updatedUser: User | null = null;
    const repo = makeUserRepo({
      findById: async () => user,
      update: async (u: User) => {
        updatedUser = u;
      },
    });
    const hasher = makeHasher();
    const useCase = new ChangePasswordUseCase(repo, hasher);

    await useCase.execute(USER_ID, {
      currentPassword: 'current-password',
      newPassword: 'new-password',
    });

    expect(updatedUser).not.toBeNull();
    expect((updatedUser as unknown as User).passwordHash.toString()).toBe('$argon2id$new-password');
  });

  it('lança InvalidCredentialsError para senha atual errada', async () => {
    const user = makeUser();
    const repo = makeUserRepo({
      findById: async () => user,
    });
    const hasher = makeHasher();
    const useCase = new ChangePasswordUseCase(repo, hasher);

    await expect(
      useCase.execute(USER_ID, {
        currentPassword: 'wrong-password',
        newPassword: 'new-password',
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('lança UserNotFoundError para usuário inexistente', async () => {
    const repo = makeUserRepo({
      findById: async () => null,
    });
    const hasher = makeHasher();
    const useCase = new ChangePasswordUseCase(repo, hasher);

    await expect(
      useCase.execute(USER_ID, {
        currentPassword: 'current-password',
        newPassword: 'new-password',
      }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
