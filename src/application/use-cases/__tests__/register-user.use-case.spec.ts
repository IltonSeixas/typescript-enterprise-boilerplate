import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { RegisterUserUseCase } from '../register-user.use-case.js';
import { UserRepository } from '../../../domain/repositories/user.repository.js';
import { PasswordHasherPort } from '../../ports/password-hasher.port.js';
import {
  EmailAlreadyExistsError,
  OwnerAlreadyExistsError,
} from '../../../domain/errors/domain.errors.js';
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
  hasOwner: async () => false,
  ...overrides,
});

const makeHasher = (): PasswordHasherPort => ({
  hash: async (plain: string) => `hashed:${plain}`,
  verify: async (hash: string, plain: string) => hash === `hashed:${plain}`,
});

const makeExistingUser = (): User =>
  User.reconstitute({
    id: UserId.create('00000000-0000-0000-0000-000000000001'),
    name: 'Existing User',
    email: Email.create('existing@example.com'),
    passwordHash: PasswordHash.fromHash('hashed:password'),
    role: 'member',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

describe('RegisterUserUseCase', () => {
  let hasher: PasswordHasherPort;

  beforeEach(() => {
    hasher = makeHasher();
  });

  it('registers a member successfully', async () => {
    const repo = makeUserRepo();
    const useCase = new RegisterUserUseCase(repo, hasher);

    const result = await useCase.execute({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'strongpassword123',
    });

    expect(result.name).toBe('Alice');
    expect(result.email).toBe('alice@example.com');
    expect(result.role).toBe('member');
    expect(result.isActive).toBe(true);
  });

  it('throws EmailAlreadyExistsError when email is taken', async () => {
    const existing = makeExistingUser();
    const repo = makeUserRepo({
      findByEmail: async () => existing,
    });
    const useCase = new RegisterUserUseCase(repo, hasher);

    await expect(
      useCase.execute({
        name: 'Bob',
        email: 'existing@example.com',
        password: 'strongpassword123',
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
  });

  it('throws OwnerAlreadyExistsError when trying to register a second owner', async () => {
    const repo = makeUserRepo({
      hasOwner: async () => true,
    });
    const useCase = new RegisterUserUseCase(repo, hasher);

    await expect(
      useCase.execute(
        {
          name: 'Second Owner',
          email: 'owner2@example.com',
          password: 'strongpassword123',
        },
        true,
      ),
    ).rejects.toBeInstanceOf(OwnerAlreadyExistsError);
  });

  it('registers owner successfully when no owner exists', async () => {
    let savedUser: User | null = null;
    const repo = makeUserRepo({
      hasOwner: async () => false,
      saveFirstOwner: async (user: User) => {
        savedUser = user;
      },
    });
    const useCase = new RegisterUserUseCase(repo, hasher);

    const result = await useCase.execute(
      {
        name: 'Owner',
        email: 'owner@example.com',
        password: 'strongpassword123',
      },
      true,
    );

    expect(result.role).toBe('owner');
    expect(savedUser).not.toBeNull();
  });
});
