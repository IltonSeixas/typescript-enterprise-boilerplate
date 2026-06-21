import 'reflect-metadata';
import { describe, it, expect } from 'bun:test';
import { InMemoryAuditAdapter } from '../in-memory-audit.adapter.js';
import { AuditEvent } from '../../../domain/entities/audit-event.entity.js';
import type { AuditLogger } from '../../../application/ports/audit.port.js';

const makeLogger = (): AuditLogger & { calls: Array<{ obj: Record<string, unknown>; msg: string }> } => {
  const calls: Array<{ obj: Record<string, unknown>; msg: string }> = [];
  return {
    calls,
    info: (obj, msg) => {
      calls.push({ obj, msg });
    },
    error: (obj, msg) => {
      calls.push({ obj, msg });
    },
  };
};

describe('InMemoryAuditAdapter', () => {
  it('logs the audit event at info level', async () => {
    const logger = makeLogger();
    const adapter = new InMemoryAuditAdapter(logger);
    const event = AuditEvent.create({
      eventType: 'login_succeeded',
      actorId: '00000000-0000-0000-0000-000000000001',
      detail: 'login succeeded',
    });

    await adapter.record(event);

    expect(logger.calls).toHaveLength(1);
    expect(logger.calls[0]?.msg).toBe('audit event recorded');
    expect(logger.calls[0]?.obj['eventType']).toBe('login_succeeded');
    expect(logger.calls[0]?.obj['auditEventId']).toBe(event.id);
  });
});
