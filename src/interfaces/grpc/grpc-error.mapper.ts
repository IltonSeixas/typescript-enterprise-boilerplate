import { status } from '@grpc/grpc-js';
import {
  DomainError,
  EmailAlreadyExistsError,
  ForbiddenError,
  InsufficientPermissionsError,
  InvalidCredentialsError,
  InvalidEmailError,
  InvalidPasswordError,
  InvalidRefreshTokenError,
  InvalidRoleError,
  InvalidUserIdError,
  OwnerAlreadyExistsError,
  ServiceUnavailableError,
  UserInactiveError,
  UserNotFoundError,
} from '../../domain/errors/domain.errors.js';

export class GrpcError extends Error {
  constructor(
    public readonly code: status,
    message: string,
  ) {
    super(message);
    this.name = 'GrpcError';
  }
}

export function toGrpcError(err: unknown): GrpcError {
  if (err instanceof DomainError) {
    return new GrpcError(codeFor(err), err.message);
  }

  return new GrpcError(status.INTERNAL, 'An unexpected error occurred');
}

function codeFor(err: DomainError): status {
  switch (true) {
    case err instanceof InvalidEmailError:
    case err instanceof InvalidPasswordError:
    case err instanceof InvalidUserIdError:
    case err instanceof InvalidRoleError:
      return status.INVALID_ARGUMENT;
    case err instanceof EmailAlreadyExistsError:
    case err instanceof OwnerAlreadyExistsError:
      return status.ALREADY_EXISTS;
    case err instanceof UserNotFoundError:
      return status.NOT_FOUND;
    case err instanceof InvalidCredentialsError:
    case err instanceof InvalidRefreshTokenError:
      return status.UNAUTHENTICATED;
    case err instanceof UserInactiveError:
    case err instanceof ForbiddenError:
    case err instanceof InsufficientPermissionsError:
      return status.PERMISSION_DENIED;
    case err instanceof ServiceUnavailableError:
      return status.UNAVAILABLE;
    default:
      return status.INTERNAL;
  }
}
