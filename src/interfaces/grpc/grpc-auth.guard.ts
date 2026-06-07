import { status, type ServerUnaryCall } from '@grpc/grpc-js';
import type { UserRepository } from '../../domain/repositories/user.repository.js';
import { UserId } from '../../domain/value-objects/user-id.vo.js';
import type { AccessTokenPayload, TokenServicePort } from '../../application/ports/token-service.port.js';
import type { GrpcError } from './grpc-error.mapper.js';

export interface AuthenticatedCaller {
  id: string;
}

/**
 * Validates the `authorization: Bearer <token>` request metadata entry and
 * ensures the underlying account is active, mirroring the REST auth plugin.
 */
export async function authenticateCall(
  call: ServerUnaryCall<unknown, unknown>,
  tokenService: TokenServicePort,
  userRepository: UserRepository,
): Promise<AuthenticatedCaller> {
  const values = call.metadata.get('authorization');
  const header = typeof values[0] === 'string' ? values[0] : '';

  if (!header.startsWith('Bearer ')) {
    throw grpcError(status.UNAUTHENTICATED, 'missing bearer token');
  }

  const token = header.slice(7);
  let payload: AccessTokenPayload;
  try {
    payload = tokenService.verifyAccessToken(token);
  } catch {
    throw grpcError(status.UNAUTHENTICATED, 'invalid or expired token');
  }

  const user = await userRepository.findById(UserId.create(payload.sub));
  if (user === null || !user.isActive) {
    throw grpcError(status.UNAUTHENTICATED, 'invalid or expired token');
  }

  return { id: payload.sub };
}

function grpcError(code: status, message: string): GrpcError {
  return { code, message };
}
