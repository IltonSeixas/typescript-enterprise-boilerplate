import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import { AuditEvent } from '../../domain/entities/audit-event.entity.js';
import {
  InvalidRefreshTokenError,
  UserInactiveError,
  UserNotFoundError,
} from '../../domain/errors/domain.errors.js';
import type { UserRepository } from '../../domain/repositories/user.repository.js';
import { UserId } from '../../domain/value-objects/user-id.vo.js';
import { AuthOutputDto } from '../dtos/auth-output.dto.js';
import type { AuditPort } from '../ports/audit.port.js';
import type { TokenServicePort } from '../ports/token-service.port.js';

@injectable()
export class RefreshTokenUseCase {
  constructor(
    @inject('UserRepository') private readonly users: UserRepository,
    @inject('TokenService') private readonly tokens: TokenServicePort,
    @inject('JwtAccessTtl') private readonly accessTtl: number,
    @inject('AuditPort') private readonly audit: AuditPort,
  ) {}

  async execute(
    token: string,
  ): Promise<AuthOutputDto & { refreshToken: string }> {
    let userId: string;
    try {
      userId = await this.tokens.consumeRefreshToken(token);
    } catch {
      throw new InvalidRefreshTokenError();
    }

    const user = await this.users.findById(UserId.create(userId));
    if (user === null) {
      throw new UserNotFoundError();
    }
    if (!user.isActive) {
      throw new UserInactiveError();
    }

    const jti = crypto.randomUUID();
    const accessToken = await this.tokens.signAccessToken({
      sub: user.id.toString(),
      jti,
    });
    const newRefreshToken = await this.tokens.issueRefreshToken(
      user.id.toString(),
    );

    await this.audit.record(
      AuditEvent.create({
        eventType: 'token_refreshed',
        actorId: user.id.toString(),
        detail: 'refresh token rotated',
      }),
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.accessTtl,
      refreshToken: newRefreshToken,
    };
  }
}
