import 'reflect-metadata';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { loadSync } from '@grpc/proto-loader';
import {
  credentials,
  loadPackageDefinition,
  Metadata,
  type GrpcObject,
  type Server,
  type ServiceClientConstructor,
} from '@grpc/grpc-js';
import { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case.js';
import { LoginUserUseCase } from '../../application/use-cases/login-user.use-case.js';
import { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case.js';
import { LogoutUserUseCase } from '../../application/use-cases/logout-user.use-case.js';
import { GetUserUseCase } from '../../application/use-cases/get-user.use-case.js';
import { UpdateProfileUseCase } from '../../application/use-cases/update-profile.use-case.js';
import { ChangePasswordUseCase } from '../../application/use-cases/change-password.use-case.js';
import { Argon2Hasher } from '../../infrastructure/security/argon2-hasher.js';
import { InMemoryUserRepository } from '../../infrastructure/persistence/in-memory/user.repository.js';
import type { TokenServicePort, AccessTokenPayload } from '../../application/ports/token-service.port.js';
import { InvalidRefreshTokenError } from '../../domain/errors/domain.errors.js';
import { createGrpcServer, startGrpcServer, stopGrpcServer } from './server.js';

const PROTO_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'proto',
  'boilerplate',
  'v1',
  'boilerplate.proto',
);

interface InMemoryTokenServiceState {
  refreshTokens: Map<string, string>;
}

function makeInMemoryTokenService(): TokenServicePort & InMemoryTokenServiceState {
  return {
    refreshTokens: new Map<string, string>(),
    signAccessToken(payload: AccessTokenPayload): string {
      return `access:${payload.sub}:${payload.jti}`;
    },
    verifyAccessToken(token: string): AccessTokenPayload {
      const [, sub, jti] = token.split(':');
      return { sub: sub ?? '', jti: jti ?? '' };
    },
    async issueRefreshToken(userId: string): Promise<string> {
      const refreshToken = `refresh:${crypto.randomUUID()}`;
      this.refreshTokens.set(refreshToken, userId);
      return refreshToken;
    },
    async consumeRefreshToken(token: string): Promise<string> {
      const userId = this.refreshTokens.get(token);
      if (userId === undefined) {
        throw new InvalidRefreshTokenError();
      }
      this.refreshTokens.delete(token);
      return userId;
    },
    async revokeRefreshToken(token: string): Promise<void> {
      this.refreshTokens.delete(token);
    },
  };
}

function loadClients(port: number): {
  auth: InstanceType<ServiceClientConstructor>;
  user: InstanceType<ServiceClientConstructor>;
} {
  const packageDefinition = loadSync(PROTO_PATH, {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const proto = loadPackageDefinition(packageDefinition);
  const boilerplate = (proto['boilerplate'] as GrpcObject)['v1'] as GrpcObject;
  const AuthServiceClient = boilerplate['AuthService'] as ServiceClientConstructor;
  const UserServiceClient = boilerplate['UserService'] as ServiceClientConstructor;

  const target = `127.0.0.1:${port}`;
  return {
    auth: new AuthServiceClient(target, credentials.createInsecure()),
    user: new UserServiceClient(target, credentials.createInsecure()),
  };
}

function call<Req, Res>(
  client: InstanceType<ServiceClientConstructor>,
  method: string,
  request: Req,
  metadata = new Metadata(),
): Promise<Res> {
  return new Promise((resolve, reject) => {
    (client[method] as (req: Req, md: Metadata, cb: (err: unknown, res: Res) => void) => void)(
      request,
      metadata,
      (err, res) => {
        if (err) {
          reject(err instanceof Error ? err : new Error('gRPC call failed', { cause: err }));
          return;
        }
        resolve(res);
      },
    );
  });
}

function bearerMetadata(token: string): Metadata {
  const metadata = new Metadata();
  metadata.set('authorization', `Bearer ${token}`);
  return metadata;
}

describe('gRPC server integration', () => {
  let server: Server;
  let port: number;
  let clients: ReturnType<typeof loadClients>;

  beforeAll(async () => {
    const userRepository = new InMemoryUserRepository();
    const hasher = new Argon2Hasher();
    const tokenService = makeInMemoryTokenService();
    const accessTtl = 900;

    server = createGrpcServer({
      registerUser: new RegisterUserUseCase(userRepository, hasher),
      loginUser: new LoginUserUseCase(userRepository, hasher, tokenService, accessTtl),
      refreshToken: new RefreshTokenUseCase(userRepository, tokenService, accessTtl),
      logoutUser: new LogoutUserUseCase(tokenService),
      getUser: new GetUserUseCase(userRepository),
      updateProfile: new UpdateProfileUseCase(userRepository),
      changePassword: new ChangePasswordUseCase(userRepository, hasher),
      tokenService,
      userRepository,
    });

    port = await startGrpcServer(server, '127.0.0.1', 0);
    clients = loadClients(port);
  });

  afterAll(async () => {
    await stopGrpcServer(server);
  }, 10000);

  it('rejects UserService calls without a bearer token', async () => {
    await expect(call(clients.user, 'getMe', {})).rejects.toMatchObject({
      code: 16, // UNAUTHENTICATED
    });
  });

  it('registers, logs in and returns the authenticated profile via GetMe', async () => {
    interface UserResponse {
      id: string;
      email: string;
      name: string;
    }
    interface AuthResponse {
      accessToken: string;
      refreshToken: string;
    }

    const registered = await call<unknown, UserResponse>(clients.auth, 'register', {
      email: 'integration@example.com',
      password: 'super-secret-password',
      name: 'Integration Tester',
    });
    expect(registered.email).toBe('integration@example.com');

    const session = await call<unknown, AuthResponse>(clients.auth, 'login', {
      email: 'integration@example.com',
      password: 'super-secret-password',
    });
    expect(session.accessToken).toBeTruthy();
    expect(session.refreshToken).toBeTruthy();

    const me = await call<unknown, UserResponse>(
      clients.user,
      'getMe',
      {},
      bearerMetadata(session.accessToken),
    );
    expect(me.id).toBe(registered.id);
    expect(me.name).toBe('Integration Tester');
  });

  it('updates the profile name through UserService.UpdateProfile', async () => {
    interface UserResponse {
      name: string;
    }
    interface AuthResponse {
      accessToken: string;
    }

    await call(clients.auth, 'register', {
      email: 'profile@example.com',
      password: 'super-secret-password',
      name: 'Before Update',
    });
    const session = await call<unknown, AuthResponse>(clients.auth, 'login', {
      email: 'profile@example.com',
      password: 'super-secret-password',
    });

    const updated = await call<unknown, UserResponse>(
      clients.user,
      'updateProfile',
      { name: 'After Update' },
      bearerMetadata(session.accessToken),
    );
    expect(updated.name).toBe('After Update');
  });

  it('rejects registration with a duplicate email', async () => {
    await call(clients.auth, 'register', {
      email: 'duplicate@example.com',
      password: 'super-secret-password',
      name: 'First',
    });

    await expect(
      call(clients.auth, 'register', {
        email: 'duplicate@example.com',
        password: 'super-secret-password',
        name: 'Second',
      }),
    ).rejects.toMatchObject({
      code: 6, // ALREADY_EXISTS
    });
  });
});
