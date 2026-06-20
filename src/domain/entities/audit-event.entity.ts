export type AuditEventType =
  | 'user_registered'
  | 'login_succeeded'
  | 'login_failed'
  | 'user_logged_out'
  | 'password_changed'
  | 'role_changed'
  | 'token_refreshed';

export interface AuditEventProps {
  id: string;
  eventType: AuditEventType;
  actorId: string | null;
  targetId: string | null;
  detail: string;
  occurredAt: Date;
}

export interface CreateAuditEventProps {
  eventType: AuditEventType;
  actorId?: string | null;
  targetId?: string | null;
  detail: string;
}

export class AuditEvent {
  private readonly props: AuditEventProps;

  private constructor(props: AuditEventProps) {
    this.props = props;
  }

  static create(input: CreateAuditEventProps): AuditEvent {
    return new AuditEvent({
      id: crypto.randomUUID(),
      eventType: input.eventType,
      actorId: input.actorId ?? null,
      targetId: input.targetId ?? null,
      detail: input.detail,
      occurredAt: new Date(),
    });
  }

  static reconstitute(props: AuditEventProps): AuditEvent {
    return new AuditEvent(props);
  }

  get id(): string {
    return this.props.id;
  }

  get eventType(): AuditEventType {
    return this.props.eventType;
  }

  get actorId(): string | null {
    return this.props.actorId;
  }

  get targetId(): string | null {
    return this.props.targetId;
  }

  get detail(): string {
    return this.props.detail;
  }

  get occurredAt(): Date {
    return this.props.occurredAt;
  }
}
