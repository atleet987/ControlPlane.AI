import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { AuditEvent, AuditEventType } from './interfaces/audit-event.interface';
import { AUDIT_PUBLISHER, AuditPublisher } from './interfaces/audit-publisher.interface';

/** The envelope minus the fields this service stamps on every event. */
export type AuditEventInput = Omit<AuditEvent, 'eventId' | 'schemaVersion' | 'occurredAt'> & {
  eventId?: string;
  occurredAt?: string;
};

/** Current version of the audit envelope, carried on every event. */
export const AUDIT_SCHEMA_VERSION = 1;

/**
 * Builds audit envelopes and hands them to whichever transport is configured.
 * Callers fire-and-forget: nothing here is on the critical path of returning a
 * response to the client.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(AUDIT_PUBLISHER) private readonly publisher: AuditPublisher) {}

  /** Hash content rather than storing it — audit records must stay safe to retain. */
  static hashContent(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
  }

  async emit(input: AuditEventInput): Promise<void> {
    const event: AuditEvent = {
      ...input,
      eventId: input.eventId ?? randomUUID(),
      schemaVersion: AUDIT_SCHEMA_VERSION,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
    };

    await this.publisher.publishDecision(event);
  }

  /** Convenience for the gateway: emit without awaiting or surfacing failures. */
  emitAsync(input: AuditEventInput): void {
    void this.emit(input).catch((error: unknown) => {
      this.logger.error(
        `Failed to emit audit event ${input.eventType} for trace ${input.traceId}`,
        error instanceof Error ? error.stack : String(error),
      );
    });
  }

  /** Which transport is active — surfaced by the readiness probe. */
  get transport(): string {
    return this.publisher.transport;
  }

  static readonly EventType = AuditEventType;
}
