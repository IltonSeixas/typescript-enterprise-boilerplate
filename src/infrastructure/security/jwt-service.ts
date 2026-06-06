import 'reflect-metadata';
import jwt from 'jsonwebtoken';
import { inject, injectable } from 'tsyringe';
import {
  AccessTokenPayload,
  TokenServicePort,
} from '../../application/ports/token-service.port.js';
import { InvalidRefreshTokenError } from '../../domain/errors/domain.errors.js';
import { RedisStore } from '../cache/redis-store.js';

const REFRESH_PREFIX = 'refresh:';

@injectable()
export class JwtService implements TokenServicePort {
  constructor(
    @inject('JwtSecret') private readonly secret: string,
    @inject('JwtAccessTtl') private readonly accessTtl: number,
    @inject('JwtRefreshTtl') private readonly refreshTtl: number,
    @inject('RedisStore') private readonly redis: RedisStore,
  ) {}

  signAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload, this.secret, {
      algorithm: 'HS256',
      expiresIn: this.accessTtl,
    });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    const decoded = jwt.verify(token, this.secret, {
      algorithms: ['HS256'],
    }) as AccessTokenPayload;
    return decoded;
  }

  async issueRefreshToken(userId: string): Promise<string> {
    const token = crypto.randomUUID();
    await this.redis.set(
      `${REFRESH_PREFIX}${token}`,
      userId,
      this.refreshTtl,
    );
    return token;
  }

  async consumeRefreshToken(token: string): Promise<string> {
    const userId = await this.redis.get(`${REFRESH_PREFIX}${token}`);
    if (userId === null) {
      throw new InvalidRefreshTokenError();
    }
    await this.redis.del(`${REFRESH_PREFIX}${token}`);
    return userId;
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await this.redis.del(`${REFRESH_PREFIX}${token}`);
  }
}
