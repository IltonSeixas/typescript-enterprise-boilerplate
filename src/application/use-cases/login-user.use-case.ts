import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import { AuditEvent } from '../../domain/entities/audit-event.entity.js';
import {
  InvalidCredentialsError,
  InvalidEmailError,
  UserInactiveError,
} from '../../domain/errors/domain.errors.js';
import type { UserRepository } from '../../domain/repositories/user.repository.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { AuthOutputDto } from '../dtos/auth-output.dto.js';
import { LoginUserDto } from '../dtos/login-user.dto.js';
import type { AuditPort } from '../ports/audit.port.js';
import type { PasswordHasherPort } from '../ports/password-hasher.port.js';
import type { TokenServicePort } from '../ports/token-service.port.js';

@injectable()
export class LoginUserUseCase {
  constructor(
    @inject('UserRepository') private readonly users: UserRepository,
    @inject('PasswordHasher') private readonly hasher: PasswordHasherPort,
    @inject('TokenService') private readonly tokens: TokenServicePort,
    @inject('JwtAccessTtl') private readonly accessTtl: number,
    @inject('AuditPort') private readonly audit: AuditPort,
  ) {}

  async execute(input: LoginUserDto): Promise<AuthOutputDto & { refreshToken: string }> {
    let email: Email;
    try {
      email = Email.create(input.email);
    } catch (err) {
      if (err instanceof InvalidEmailError) {
        await this.audit.record(
          AuditEvent.create({ eventType: 'login_failed', detail: 'malformed email' }),
        );
        throw new InvalidCredentialsError();
      }
      throw err;
    }

    const user = await this.users.findByEmail(email);

    if (user === null) {
      await this.audit.record(
        AuditEvent.create({ eventType: 'login_failed', detail: 'no account for email' }),
      );
      throw new InvalidCredentialsError();
    }

    if (!user.isActive) {
      await this.audit.record(
        AuditEvent.create({
          eventType: 'login_failed',
          actorId: user.id.toString(),
          detail: 'account inactive',
        }),
      );
      throw new UserInactiveError();
    }

    const valid = await this.hasher.verify(
      user.passwordHash.toString(),
      input.password,
    );
    if (!valid) {
      await this.audit.record(
        AuditEvent.create({
          eventType: 'login_failed',
          actorId: user.id.toString(),
          detail: 'invalid password',
        }),
      );
      throw new InvalidCredentialsError();
    }

    const jti = crypto.randomUUID();
    const accessToken = await this.tokens.signAccessToken({
      sub: user.id.toString(),
      jti,
    });
    const refreshToken = await this.tokens.issueRefreshToken(user.id.toString());

    await this.audit.record(
      AuditEvent.create({
        eventType: 'login_succeeded',
        actorId: user.id.toString(),
        detail: 'login succeeded',
      }),
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.accessTtl,
      refreshToken,
    };
  }
}
