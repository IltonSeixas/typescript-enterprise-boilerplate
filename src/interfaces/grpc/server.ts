import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSync } from '@grpc/proto-loader';
import { loadPackageDefinition, Server, ServerCredentials, type GrpcObject, type ServiceClientConstructor } from '@grpc/grpc-js';
import { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case.js';
import { LoginUserUseCase } from '../../application/use-cases/login-user.use-case.js';
import { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case.js';
import { LogoutUserUseCase } from '../../application/use-cases/logout-user.use-case.js';
import { GetUserUseCase } from '../../application/use-cases/get-user.use-case.js';
import { UpdateProfileUseCase } from '../../application/use-cases/update-profile.use-case.js';
import { ChangePasswordUseCase } from '../../application/use-cases/change-password.use-case.js';
import type { TokenServicePort } from '../../application/ports/token-service.port.js';
import type { UserRepository } from '../../domain/repositories/user.repository.js';
import { AuthServiceGrpc, bindAuthService } from './auth-service.grpc.js';
import { UserServiceGrpc, bindUserService } from './user-service.grpc.js';

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

export interface GrpcServerDependencies {
  registerUser: RegisterUserUseCase;
  loginUser: LoginUserUseCase;
  refreshToken: RefreshTokenUseCase;
  logoutUser: LogoutUserUseCase;
  getUser: GetUserUseCase;
  updateProfile: UpdateProfileUseCase;
  changePassword: ChangePasswordUseCase;
  tokenService: TokenServicePort;
  userRepository: UserRepository;
}

export function createGrpcServer(deps: GrpcServerDependencies): Server {
  const packageDefinition = loadSync(PROTO_PATH, {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const proto = loadPackageDefinition(packageDefinition);
  const boilerplate = (proto['boilerplate'] as GrpcObject)['v1'] as GrpcObject;
  const authServiceDef = boilerplate['AuthService'] as ServiceClientConstructor;
  const userServiceDef = boilerplate['UserService'] as ServiceClientConstructor;

  const authService = new AuthServiceGrpc(
    deps.registerUser,
    deps.loginUser,
    deps.refreshToken,
    deps.logoutUser,
  );
  const userService = new UserServiceGrpc(
    deps.getUser,
    deps.updateProfile,
    deps.changePassword,
    deps.tokenService,
    deps.userRepository,
  );

  const server = new Server();
  server.addService(authServiceDef.service, bindAuthService(authService));
  server.addService(userServiceDef.service, bindUserService(userService));

  return server;
}

export async function startGrpcServer(server: Server, host: string, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    server.bindAsync(`${host}:${port}`, ServerCredentials.createInsecure(), (err, boundPort) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(boundPort);
    });
  });
}

export async function stopGrpcServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    const forceShutdownTimer = setTimeout(() => {
      server.forceShutdown();
      resolve();
    }, 5000);

    server.tryShutdown(() => {
      clearTimeout(forceShutdownTimer);
      resolve();
    });
  });
}
