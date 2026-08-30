import { AuditEvent } from './audit-event.interface';

/**
 * The single seam between the audit module and its transport.
 *
 * There is exactly one method, and it takes the same envelope we would put on
 * a Kafka topic. Swapping `DatabaseAuditPublisher` for a `KafkaAuditPublisher`
 * is therefore a provider change in `AuditModule` — no caller changes, no
 * schema translation.
 */
export interface AuditPublisher {
  /** Transport identifier, surfaced in logs and health output. */
  readonly transport: string;

  publishDecision(event: AuditEvent): Promise<void>;
}

/** DI token — consumers inject the interface, never a concrete publisher. */
export const AUDIT_PUBLISHER = Symbol('AUDIT_PUBLISHER');
