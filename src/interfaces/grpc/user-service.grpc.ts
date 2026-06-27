import type { sendUnaryData, ServerUnaryCall, UntypedHandleCall } from '@grpc/grpc-js';
import { GetUserUseCase } from '../../application/use-cases/get-user.use-case.js';
import { ListUsersUseCase } from '../../application/use-cases/list-users.use-case.js';
import { UpdateProfileUseCase } from '../../application/use-cases/update-profile.use-case.js';
import { ChangePasswordUseCase } from '../../application/use-cases/change-password.use-case.js';
import { ChangeRoleUseCase } from '../../application/use-cases/change-role.use-case.js';
import { UpdateProfileSchema } from '../../application/dtos/update-profile.dto.js';
import { ChangePasswordSchema } from '../../application/dtos/change-password.dto.js';
import { ChangeRoleSchema } from '../../application/dtos/change-role.dto.js';
import type { UserOutputDto } from '../../application/dtos/auth-output.dto.js';
import type { ListUsersOutputDto } from '../../application/dtos/list-users.dto.js';
import type { TokenServicePort } from '../../application/ports/token-service.port.js';
import type { UserRepository } from '../../domain/repositories/user.repository.js';
import { authenticateCall } from './grpc-auth.guard.js';
import { toGrpcError } from './grpc-error.mapper.js';
import { parseRequest } from './parse-request.js';

type GetMeRequest = Record<string, never>;

interface ListUsersRequest {
  page: number;
  pageSize: number;
}

interface UpdateProfileRequest {
  name: string;
}

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

interface ChangeRoleRequest {
  userId: string;
  role: string;
}

export class UserServiceGrpc {
  constructor(
    private readonly getUser: GetUserUseCase,
    private readonly listUsers: ListUsersUseCase,
    private readonly updateProfile: UpdateProfileUseCase,
    private readonly changePassword: ChangePasswordUseCase,
    private readonly changeRole: ChangeRoleUseCase,
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

  listUsersHandler = (
    call: ServerUnaryCall<ListUsersRequest, ListUsersOutputDto>,
    callback: sendUnaryData<ListUsersOutputDto>,
  ): void => {
    void this.handle(call, callback, async (request, callerId) => {
      return this.listUsers.execute(callerId, {
        page: request.page > 0 ? request.page : undefined,
        pageSize: request.pageSize > 0 ? request.pageSize : undefined,
      });
    });
  };

  updateProfileHandler = (
    call: ServerUnaryCall<UpdateProfileRequest, UserOutputDto>,
    callback: sendUnaryData<UserOutputDto>,
  ): void => {
    void this.handle(call, callback, async (request, callerId) => {
      const input = parseRequest(UpdateProfileSchema, { name: request.name });
      return this.updateProfile.execute(callerId, input);
    });
  };

  changePasswordHandler = (
    call: ServerUnaryCall<ChangePasswordRequest, Record<string, never>>,
    callback: sendUnaryData<Record<string, never>>,
  ): void => {
    void this.handle(call, callback, async (request, callerId) => {
      const input = parseRequest(ChangePasswordSchema, {
        currentPassword: request.currentPassword,
        newPassword: request.newPassword,
      });
      await this.changePassword.execute(callerId, input);
      return {};
    });
  };

  changeRoleHandler = (
    call: ServerUnaryCall<ChangeRoleRequest, UserOutputDto>,
    callback: sendUnaryData<UserOutputDto>,
  ): void => {
    void this.handle(call, callback, async (request, callerId) => {
      const input = parseRequest(ChangeRoleSchema, { role: request.role });
      return this.changeRole.execute(callerId, request.userId, input);
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
    listUsers: service.listUsersHandler,
    updateProfile: service.updateProfileHandler,
    changePassword: service.changePasswordHandler,
    changeRole: service.changeRoleHandler,
  };
}
