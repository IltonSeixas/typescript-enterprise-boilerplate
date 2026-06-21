import 'reflect-metadata';
import { describe, it, expect } from 'bun:test';
import { UpdateProfileUseCase } from '../update-profile.use-case.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import { UserNotFoundError } from '../../../domain/errors/domain.errors.js';
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
  findPaginated: async () => ({ items: [], total: 0 }),
  ...overrides,
});

const makeUser = (): User =>
  User.reconstitute({
    id: UserId.create(USER_ID),
    name: 'Alice',
    email: Email.create('alice@example.com'),
    passwordHash: PasswordHash.fromHash('$argon2id$password'),
    role: 'member',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

describe('UpdateProfileUseCase', () => {
  it('atualiza nome com sucesso e retorna UserOutputDto', async () => {
    const user = makeUser();
    const repo = makeUserRepo({
      findById: async () => user,
    });
    const useCase = new UpdateProfileUseCase(repo);

    const result = await useCase.execute(USER_ID, { name: 'Alice Updated' });

    expect(result.name).toBe('Alice Updated');
    expect(result.id).toBe(USER_ID);
    expect(result.email).toBe('alice@example.com');
    expect(result.role).toBe('member');
    expect(result.isActive).toBe(true);
    expect(result.createdAt).toBeDefined();
    expect(result.updatedAt).toBeDefined();
  });

  it('lança UserNotFoundError para usuário inexistente', async () => {
    const repo = makeUserRepo({
      findById: async () => null,
    });
    const useCase = new UpdateProfileUseCase(repo);

    await expect(
      useCase.execute(USER_ID, { name: 'New Name' }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
