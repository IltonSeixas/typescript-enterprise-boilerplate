import type { sendUnaryData, ServerUnaryCall, UntypedHandleCall } from '@grpc/grpc-js';
import { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case.js';
import { LoginUserUseCase } from '../../application/use-cases/login-user.use-case.js';
import { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case.js';
import { LogoutUserUseCase } from '../../application/use-cases/logout-user.use-case.js';
import { RegisterUserSchema } from '../../application/dtos/register-user.dto.js';
import { LoginUserSchema } from '../../application/dtos/login-user.dto.js';
import type { AuthOutputDto, UserOutputDto } from '../../application/dtos/auth-output.dto.js';
import { toGrpcError } from './grpc-error.mapper.js';

interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface RefreshTokenRequest {
  refreshToken: string;
}

interface LogoutRequest {
  refreshToken: string;
}

type AuthResponse = AuthOutputDto & { refreshToken: string };

export class AuthServiceGrpc {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly loginUser: LoginUserUseCase,
    private readonly refreshToken: RefreshTokenUseCase,
    private readonly logoutUser: LogoutUserUseCase,
  ) {}

  register = (
    call: ServerUnaryCall<RegisterRequest, UserOutputDto>,
    callback: sendUnaryData<UserOutputDto>,
  ): void => {
    void this.handle(call, callback, async (request) => {
      const input = RegisterUserSchema.parse({
        name: request.name,
        email: request.email,
        password: request.password,
      });
      return this.registerUser.execute(input);
    });
  };

  login = (
    call: ServerUnaryCall<LoginRequest, AuthResponse>,
    callback: sendUnaryData<AuthResponse>,
  ): void => {
    void this.handle(call, callback, async (request) => {
      const input = LoginUserSchema.parse({
        email: request.email,
        password: request.password,
      });
      return this.loginUser.execute(input);
    });
  };

  refresh = (
    call: ServerUnaryCall<RefreshTokenRequest, AuthResponse>,
    callback: sendUnaryData<AuthResponse>,
  ): void => {
    void this.handle(call, callback, async (request) => {
      return this.refreshToken.execute(request.refreshToken);
    });
  };

  logout = (
    call: ServerUnaryCall<LogoutRequest, Record<string, never>>,
    callback: sendUnaryData<Record<string, never>>,
  ): void => {
    void this.handle(call, callback, async (request) => {
      await this.logoutUser.execute(request.refreshToken);
      return {};
    });
  };

  private async handle<Req, Res>(
    call: ServerUnaryCall<Req, Res>,
    callback: sendUnaryData<Res>,
    fn: (request: Req) => Promise<Res>,
  ): Promise<void> {
    try {
      const response = await fn(call.request);
      callback(null, response);
    } catch (err) {
      callback(toGrpcError(err), null);
    }
  }
}

export function bindAuthService(service: AuthServiceGrpc): Record<string, UntypedHandleCall> {
  return {
    register: service.register,
    login: service.login,
    refreshToken: service.refresh,
    logout: service.logout,
  };
}
