export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidEmailError extends DomainError {
  readonly code = 'INVALID_EMAIL';

  constructor(raw: string) {
    super(`Invalid email address: ${raw}`);
  }
}

export class InvalidPasswordError extends DomainError {
  readonly code = 'INVALID_PASSWORD';

  constructor(reason: string) {
    super(`Invalid password: ${reason}`);
  }
}

export class InvalidUserIdError extends DomainError {
  readonly code = 'INVALID_USER_ID';

  constructor(raw: string) {
    super(`Invalid user ID: ${raw}`);
  }
}

export class EmailAlreadyExistsError extends DomainError {
  readonly code = 'EMAIL_ALREADY_EXISTS';

  constructor(email: string) {
    super(`Email already registered: ${email}`);
  }
}

export class UserNotFoundError extends DomainError {
  readonly code = 'USER_NOT_FOUND';

  constructor() {
    super('User not found');
  }
}

export class InvalidCredentialsError extends DomainError {
  readonly code = 'INVALID_CREDENTIALS';

  constructor() {
    super('Invalid credentials');
  }
}

export class UserInactiveError extends DomainError {
  readonly code = 'USER_INACTIVE';

  constructor() {
    super('User account is inactive');
  }
}

export class InvalidRefreshTokenError extends DomainError {
  readonly code = 'INVALID_REFRESH_TOKEN';

  constructor() {
    super('Refresh token is invalid or expired');
  }
}

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';

  constructor() {
    super('Access denied');
  }
}

export class OwnerAlreadyExistsError extends DomainError {
  readonly code = 'OWNER_ALREADY_EXISTS';

  constructor() {
    super('An owner account already exists');
  }
}
