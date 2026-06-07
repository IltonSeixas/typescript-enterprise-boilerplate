import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import type { TokenServicePort } from '../ports/token-service.port.js';

@injectable()
export class LogoutUserUseCase {
  constructor(
    @inject('TokenService') private readonly tokens: TokenServicePort,
  ) {}

  async execute(refreshToken: string): Promise<void> {
    await this.tokens.revokeRefreshToken(refreshToken);
  }
}
