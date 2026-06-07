import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'bun:test';
import { LoginUserUseCase } from '../login-user.use-case.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import type { PasswordHasherPort } from '../../ports/password-hasher.port.js';
import type { TokenServicePort, AccessTokenPayload } from '../../ports/token-service.port.js';
import {
  InvalidCredentialsError,
  UserInactiveError,
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

const makeTokenService = (): TokenServicePort => ({
  signAccessToken: (_payload: AccessTokenPayload) => 'access-token',
  verifyAccessToken: (_token: string) => ({ sub: 'user-id', jti: 'jti' }),
  issueRefreshToken: async (_userId: string) => 'refresh-token',
  consumeRefreshToken: async (_token: string) => 'user-id',
  revokeRefreshToken: async (_token: string) => {},
});

const makeActiveUser = (overrides?: Partial<{ isActive: boolean }>): User =>
  User.reconstitute({
    id: UserId.create('00000000-0000-0000-0000-000000000001'),
    name: 'Alice',
    email: Email.create('alice@example.com'),
    passwordHash: PasswordHash.fromHash('hashed:correctpassword'),
    role: 'member',
    isActive: overrides?.isActive ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

describe('LoginUserUseCase', () => {
  let hasher: PasswordHasherPort;
  let tokenService: TokenServicePort;

  beforeEach(() => {
    hasher = makeHasher();
    tokenService = makeTokenService();
  });

  it('returns accessToken and refreshToken on successful login', async () => {
    const user = makeActiveUser();
    const repo = makeUserRepo({
      findByEmail: async () => user,
    });
    const useCase = new LoginUserUseCase(repo, hasher, tokenService, 900);

    const result = await useCase.execute({
      email: 'alice@example.com',
      password: 'correctpassword',
    });

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.tokenType).toBe('Bearer');
    expect(result.expiresIn).toBe(900);
  });

  it('throws InvalidCredentialsError for unknown email', async () => {
    const repo = makeUserRepo({
      findByEmail: async () => null,
    });
    const useCase = new LoginUserUseCase(repo, hasher, tokenService, 900);

    await expect(
      useCase.execute({ email: 'unknown@example.com', password: 'somepassword' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('throws InvalidCredentialsError for wrong password', async () => {
    const user = makeActiveUser();
    const repo = makeUserRepo({
      findByEmail: async () => user,
    });
    const useCase = new LoginUserUseCase(repo, hasher, tokenService, 900);

    await expect(
      useCase.execute({ email: 'alice@example.com', password: 'wrongpassword' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('throws UserInactiveError for inactive user', async () => {
    const user = makeActiveUser({ isActive: false });
    const repo = makeUserRepo({
      findByEmail: async () => user,
    });
    const useCase = new LoginUserUseCase(repo, hasher, tokenService, 900);

    await expect(
      useCase.execute({ email: 'alice@example.com', password: 'correctpassword' }),
    ).rejects.toBeInstanceOf(UserInactiveError);
  });
});
