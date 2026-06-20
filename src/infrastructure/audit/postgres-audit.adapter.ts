import 'reflect-metadata';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { inject, injectable } from 'tsyringe';
import type { AuditEvent } from '../../domain/entities/audit-event.entity.js';
import type { AuditLogger, AuditPort } from '../../application/ports/audit.port.js';
import { auditLog } from '../persistence/postgres/schema.js';

@injectable()
export class PostgresAuditAdapter implements AuditPort {
  constructor(
    @inject('Database') private readonly db: PostgresJsDatabase,
    @inject('Logger') private readonly logger: AuditLogger,
  ) {}

  async record(event: AuditEvent): Promise<void> {
    try {
      await this.db.insert(auditLog).values({
        id: event.id,
        eventType: event.eventType,
        actorId: event.actorId,
        targetId: event.targetId,
        detail: event.detail,
        occurredAt: event.occurredAt,
      });
    } catch (err) {
      this.logger.error(
        { err, auditEventId: event.id },
        'failed to persist audit event',
      );
    }
  }
}
