import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import { AuditEvent } from '../../domain/entities/audit-event.entity.js';
import type { AuditPort } from '../ports/audit.port.js';
import type { TokenServicePort } from '../ports/token-service.port.js';

@injectable()
export class LogoutUserUseCase {
  constructor(
    @inject('TokenService') private readonly tokens: TokenServicePort,
    @inject('AuditPort') private readonly audit: AuditPort,
  ) {}

  async execute(refreshToken: string): Promise<void> {
    await this.tokens.revokeRefreshToken(refreshToken);

    await this.audit.record(
      AuditEvent.create({ eventType: 'user_logged_out', detail: 'user logged out' }),
    );
  }
}
