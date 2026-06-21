import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'bun:test';
import { ListUsersUseCase } from '../list-users.use-case.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import {
  InsufficientPermissionsError,
  UserNotFoundError,
} from '../../../domain/errors/domain.errors.js';
import { User } from '../../../domain/entities/user.entity.js';
import { Email } from '../../../domain/value-objects/email.vo.js';
import { PasswordHash } from '../../../domain/value-objects/password-hash.vo.js';
import { UserId } from '../../../domain/value-objects/user-id.vo.js';

const OWNER_ID = '00000000-0000-0000-0000-000000000001';
const MEMBER_ID = '00000000-0000-0000-0000-000000000002';

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

const makeUser = (id: string, role: 'owner' | 'admin' | 'member'): User =>
  User.reconstitute({
    id: UserId.create(id),
    name: 'Test User',
    email: Email.create(`user-${id}@example.com`),
    passwordHash: PasswordHash.fromHash('$argon2id$password'),
    role,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

describe('ListUsersUseCase', () => {
  let owner: User;
  let member: User;

  beforeEach(() => {
    owner = makeUser(OWNER_ID, 'owner');
    member = makeUser(MEMBER_ID, 'member');
  });

  it('owner recebe a página solicitada com metadados de paginação', async () => {
    const repo = makeUserRepo({
      findById: async (id) => (id.toString() === OWNER_ID ? owner : null),
      findPaginated: async (offset, limit) => {
        expect(offset).toBe(20);
        expect(limit).toBe(10);
        return { items: [member], total: 21 };
      },
    });
    const useCase = new ListUsersUseCase(repo);

    const result = await useCase.execute(OWNER_ID, { page: 3, pageSize: 10 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(MEMBER_ID);
    expect(result.pagination).toEqual({
      page: 3,
      pageSize: 10,
      totalItems: 21,
      totalPages: 3,
    });
  });

  it('usa página 1 e tamanho de página padrão quando ausentes', async () => {
    const repo = makeUserRepo({
      findById: async (id) => (id.toString() === OWNER_ID ? owner : null),
      findPaginated: async (offset, limit) => {
        expect(offset).toBe(0);
        expect(limit).toBe(20);
        return { items: [], total: 0 };
      },
    });
    const useCase = new ListUsersUseCase(repo);

    const result = await useCase.execute(OWNER_ID, {});

    expect(result.pagination.page).toBe(1);
    expect(result.pagination.pageSize).toBe(20);
    expect(result.pagination.totalPages).toBe(0);
  });

  it('admin pode listar usuários', async () => {
    const admin = makeUser(OWNER_ID, 'admin');
    const repo = makeUserRepo({
      findById: async (id) => (id.toString() === OWNER_ID ? admin : null),
      findPaginated: async () => ({ items: [], total: 0 }),
    });
    const useCase = new ListUsersUseCase(repo);

    await expect(useCase.execute(OWNER_ID, {})).resolves.toBeDefined();
  });

  it('membro não pode listar usuários — lança InsufficientPermissionsError', async () => {
    const repo = makeUserRepo({
      findById: async (id) => (id.toString() === MEMBER_ID ? member : null),
    });
    const useCase = new ListUsersUseCase(repo);

    await expect(useCase.execute(MEMBER_ID, {})).rejects.toBeInstanceOf(
      InsufficientPermissionsError,
    );
  });

  it('lança UserNotFoundError quando o requisitante não existe', async () => {
    const repo = makeUserRepo({
      findById: async () => null,
    });
    const useCase = new ListUsersUseCase(repo);

    await expect(useCase.execute(MEMBER_ID, {})).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
