import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { DecisionAction, InspectionStage, RiskTier } from '../../../common/enums';
import { DetectionSignal } from '../../../common/interfaces';
import { AuditEventType } from '../interfaces/audit-event.interface';

/**
 * Local stand-in for the Kafka audit topic.
 *
 * PLACEHOLDER FOR KAFKA — the columns below are a flattened, one-to-one
 * mapping of the `AuditEvent` envelope, so the eventual Kafka message and this
 * row carry identical fields. Rows are append-only and never updated, which is
 * what makes the table behave like a log rather than a mutable store.
 *
 * Production would publish to Kafka instead: this table gives no durability
 * guarantees beyond the local file and supports no multi-consumer fan-out.
 */
@Entity('audit_events')
export class AuditEventEntity {
  /** Supplied by the producer, not generated here — same id as the Kafka key. */
  @PrimaryColumn({ name: 'event_id', type: 'varchar', length: 64 })
  eventId!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 64 })
  @Index()
  eventType!: AuditEventType;

  @Column({ name: 'schema_version', type: 'int', default: 1 })
  schemaVersion!: number;

  @Column({ name: 'trace_id', type: 'varchar', length: 64 })
  @Index()
  traceId!: string;

  @Column({ name: 'use_case_id', type: 'varchar', length: 128 })
  @Index()
  useCaseId!: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 128, nullable: true })
  tenantId!: string | null;

  @Column({ name: 'user_id', type: 'varchar', length: 128, nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar', length: 16 })
  stage!: InspectionStage;

  @Column({ name: 'risk_tier', type: 'varchar', length: 16 })
  riskTier!: RiskTier;

  @Column({ type: 'varchar', length: 16, nullable: true })
  action!: DecisionAction | null;

  /** Detector findings, including each label and its confidence score. */
  @Column({ type: 'simple-json', nullable: true })
  signals!: DetectionSignal[] | null;

  @Column({ type: 'simple-json', nullable: true })
  reasons!: string[] | null;

  @Column({ name: 'policy_version', type: 'int', nullable: true })
  policyVersion!: number | null;

  /** SHA-256 of the inspected content; the content itself is never stored. */
  @Column({ name: 'content_hash', type: 'varchar', length: 64, nullable: true })
  contentHash!: string | null;

  @Column({ name: 'latency_ms', type: 'int', nullable: true })
  latencyMs!: number | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata!: Record<string, unknown> | null;

  /** When the event happened, as reported by the producer. */
  @Column({ name: 'occurred_at', type: 'datetime' })
  @Index()
  occurredAt!: Date;

  /** When this row was written locally — the Kafka broker timestamp analogue. */
  @CreateDateColumn({ name: 'recorded_at' })
  recordedAt!: Date;
}
