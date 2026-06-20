import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import type { AuditEvent } from '../../domain/entities/audit-event.entity.js';
import type { AuditLogger, AuditPort } from '../../application/ports/audit.port.js';

@injectable()
export class InMemoryAuditAdapter implements AuditPort {
  constructor(@inject('Logger') private readonly logger: AuditLogger) {}

  record(event: AuditEvent): Promise<void> {
    this.logger.info(
      {
        auditEventId: event.id,
        eventType: event.eventType,
        actorId: event.actorId,
        targetId: event.targetId,
        detail: event.detail,
        occurredAt: event.occurredAt.toISOString(),
      },
      'audit event recorded',
    );
    return Promise.resolve();
  }
}
