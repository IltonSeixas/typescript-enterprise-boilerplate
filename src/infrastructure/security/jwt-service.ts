import 'reflect-metadata';
import { importPKCS8, importSPKI, jwtVerify, SignJWT, type CryptoKey } from 'jose';
import { inject, injectable } from 'tsyringe';
import {
  AccessTokenPayload,
  TokenServicePort,
} from '../../application/ports/token-service.port.js';
import { InvalidRefreshTokenError } from '../../domain/errors/domain.errors.js';
import { RedisStore } from '../cache/redis-store.js';

const REFRESH_PREFIX = 'refresh:';
const ALGORITHM = 'EdDSA';

@injectable()
export class JwtService implements TokenServicePort {
  private privateKeyPromise: Promise<CryptoKey> | undefined;
  private publicKeyPromise: Promise<CryptoKey> | undefined;

  constructor(
    @inject('JwtPrivateKey') private readonly privateKey: string,
    @inject('JwtPublicKey') private readonly publicKey: string,
    @inject('JwtAccessTtl') private readonly accessTtl: number,
    @inject('JwtRefreshTtl') private readonly refreshTtl: number,
    @inject('RedisStore') private readonly redis: RedisStore,
  ) {}

  async signAccessToken(payload: AccessTokenPayload): Promise<string> {
    const key = await this.getPrivateKey();
    return new SignJWT({ jti: payload.jti })
      .setProtectedHeader({ alg: ALGORITHM })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + this.accessTtl)
      .sign(key);
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const key = await this.getPublicKey();
    const { payload } = await jwtVerify(token, key, {
      algorithms: [ALGORITHM],
    });
    return { sub: payload.sub as string, jti: payload['jti'] as string };
  }

  private getPrivateKey(): Promise<CryptoKey> {
    this.privateKeyPromise ??= importPKCS8(this.privateKey, ALGORITHM);
    return this.privateKeyPromise;
  }

  private getPublicKey(): Promise<CryptoKey> {
    this.publicKeyPromise ??= importSPKI(this.publicKey, ALGORITHM);
    return this.publicKeyPromise;
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
