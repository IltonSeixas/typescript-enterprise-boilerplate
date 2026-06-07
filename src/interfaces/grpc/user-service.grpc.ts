import type { sendUnaryData, ServerUnaryCall, UntypedHandleCall } from '@grpc/grpc-js';
import { GetUserUseCase } from '../../application/use-cases/get-user.use-case.js';
import { UpdateProfileUseCase } from '../../application/use-cases/update-profile.use-case.js';
import { ChangePasswordUseCase } from '../../application/use-cases/change-password.use-case.js';
import { UpdateProfileSchema } from '../../application/dtos/update-profile.dto.js';
import { ChangePasswordSchema } from '../../application/dtos/change-password.dto.js';
import type { UserOutputDto } from '../../application/dtos/auth-output.dto.js';
import type { TokenServicePort } from '../../application/ports/token-service.port.js';
import type { UserRepository } from '../../domain/repositories/user.repository.js';
import { authenticateCall } from './grpc-auth.guard.js';
import { toGrpcError } from './grpc-error.mapper.js';

interface GetMeRequest {}

interface UpdateProfileRequest {
  name: string;
}

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export class UserServiceGrpc {
  constructor(
    private readonly getUser: GetUserUseCase,
    private readonly updateProfile: UpdateProfileUseCase,
    private readonly changePassword: ChangePasswordUseCase,
    private readonly tokenService: TokenServicePort,
    private readonly userRepository: UserRepository,
  ) {}

  getMe = (
    call: ServerUnaryCall<GetMeRequest, UserOutputDto>,
    callback: sendUnaryData<UserOutputDto>,
  ): void => {
    void this.handle(call, callback, async (_request, callerId) => {
      return this.getUser.execute(callerId, callerId);
    });
  };

  updateProfileHandler = (
    call: ServerUnaryCall<UpdateProfileRequest, UserOutputDto>,
    callback: sendUnaryData<UserOutputDto>,
  ): void => {
    void this.handle(call, callback, async (request, callerId) => {
      const input = UpdateProfileSchema.parse({ name: request.name });
      return this.updateProfile.execute(callerId, input);
    });
  };

  changePasswordHandler = (
    call: ServerUnaryCall<ChangePasswordRequest, Record<string, never>>,
    callback: sendUnaryData<Record<string, never>>,
  ): void => {
    void this.handle(call, callback, async (request, callerId) => {
      const input = ChangePasswordSchema.parse({
        currentPassword: request.currentPassword,
        newPassword: request.newPassword,
      });
      await this.changePassword.execute(callerId, input);
      return {};
    });
  };

  private async handle<Req, Res>(
    call: ServerUnaryCall<Req, Res>,
    callback: sendUnaryData<Res>,
    fn: (request: Req, callerId: string) => Promise<Res>,
  ): Promise<void> {
    try {
      const caller = await authenticateCall(
        call as ServerUnaryCall<unknown, unknown>,
        this.tokenService,
        this.userRepository,
      );
      const response = await fn(call.request, caller.id);
      callback(null, response);
    } catch (err) {
      const grpcError = isGrpcError(err) ? err : toGrpcError(err);
      callback(grpcError, null);
    }
  }
}

function isGrpcError(err: unknown): err is { code: number; message: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'message' in err &&
    typeof (err as { code: unknown }).code === 'number'
  );
}

export function bindUserService(service: UserServiceGrpc): Record<string, UntypedHandleCall> {
  return {
    getMe: service.getMe,
    updateProfile: service.updateProfileHandler,
    changePassword: service.changePasswordHandler,
  };
}
