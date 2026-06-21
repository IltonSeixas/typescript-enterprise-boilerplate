import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'bun:test';
import { GetUserUseCase } from '../get-user.use-case.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import {
  ForbiddenError,
  UserNotFoundError,
} from '../../../domain/errors/domain.errors.js';
import { User } from '../../../domain/entities/user.entity.js';
import { Email } from '../../../domain/value-objects/email.vo.js';
import { PasswordHash } from '../../../domain/value-objects/password-hash.vo.js';
import { UserId } from '../../../domain/value-objects/user-id.vo.js';

const OWNER_ID = '00000000-0000-0000-0000-000000000001';
const MEMBER_A_ID = '00000000-0000-0000-0000-000000000002';
const MEMBER_B_ID = '00000000-0000-0000-0000-000000000003';

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

describe('GetUserUseCase', () => {
  let owner: User;
  let memberA: User;
  let memberB: User;

  beforeEach(() => {
    owner = makeUser(OWNER_ID, 'owner');
    memberA = makeUser(MEMBER_A_ID, 'member');
    memberB = makeUser(MEMBER_B_ID, 'member');
  });

  it('owner pode buscar qualquer usuário', async () => {
    const repo = makeUserRepo({
      findById: async (id) => {
        const str = id.toString();
        if (str === OWNER_ID) return owner;
        if (str === MEMBER_A_ID) return memberA;
        return null;
      },
    });
    const useCase = new GetUserUseCase(repo);

    const result = await useCase.execute(OWNER_ID, MEMBER_A_ID);

    expect(result.id).toBe(MEMBER_A_ID);
  });

  it('membro pode buscar a si mesmo', async () => {
    const repo = makeUserRepo({
      findById: async (id) => {
        if (id.toString() === MEMBER_A_ID) return memberA;
        return null;
      },
    });
    const useCase = new GetUserUseCase(repo);

    const result = await useCase.execute(MEMBER_A_ID, MEMBER_A_ID);

    expect(result.id).toBe(MEMBER_A_ID);
  });

  it('membro não pode buscar outro membro — lança ForbiddenError', async () => {
    const repo = makeUserRepo({
      findById: async (id) => {
        if (id.toString() === MEMBER_A_ID) return memberA;
        if (id.toString() === MEMBER_B_ID) return memberB;
        return null;
      },
    });
    const useCase = new GetUserUseCase(repo);

    await expect(
      useCase.execute(MEMBER_A_ID, MEMBER_B_ID),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('requisitante inexistente não pode buscar outro usuário — lança ForbiddenError', async () => {
    const repo = makeUserRepo({
      findById: async (id) => {
        if (id.toString() === MEMBER_A_ID) return memberA;
        return null;
      },
    });
    const useCase = new GetUserUseCase(repo);

    await expect(
      useCase.execute(MEMBER_B_ID, MEMBER_A_ID),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('lança UserNotFoundError para ID inexistente', async () => {
    const repo = makeUserRepo({
      findById: async (id) => {
        if (id.toString() === OWNER_ID) return owner;
        return null;
      },
    });
    const useCase = new GetUserUseCase(repo);

    await expect(
      useCase.execute(OWNER_ID, MEMBER_A_ID),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
