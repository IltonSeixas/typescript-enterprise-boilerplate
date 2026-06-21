import type { AuditEvent } from '../../domain/entities/audit-event.entity.js';

/**
 * Implementations must never throw — on any underlying failure, log and
 * degrade gracefully rather than rejecting the use case they observe.
 */
export interface AuditPort {
  record(event: AuditEvent): Promise<void>;
}

export interface AuditLogger {
  info(obj: Record<string, unknown>, msg: string): void;
  error(obj: Record<string, unknown>, msg: string): void;
}
