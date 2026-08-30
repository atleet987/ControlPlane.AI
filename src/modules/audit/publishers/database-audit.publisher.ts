import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { AuditEvent } from '../interfaces/audit-event.interface';
import { AuditPublisher } from '../interfaces/audit-publisher.interface';

/**
 * PLACEHOLDER FOR KAFKA.
 *
 * Writes each decision event as a row in `audit_events` instead of producing
 * to a Kafka topic. This exists because no free hosted Kafka is available for
 * prototype development (Upstash withdrew its hosted Kafka offering, and
 * running a broker locally needs Docker, which this environment cannot run).
 *
 * Production would use Kafka: it gives durability independent of the service's
 * own database, and multi-consumer fan-out so alerting, analytics and
 * compliance archival can each read the stream at their own pace. A table gets
 * neither — every reader would poll the same rows and compete with the
 * gateway's own writes.
 *
 * The swap is `AuditModule` pointing `AUDIT_PUBLISHER` at a Kafka
 * implementation of the same one-method interface. Nothing else changes.
 */
@Injectable()
export class DatabaseAuditPublisher implements AuditPublisher {
  readonly transport = 'database';

  private readonly logger = new Logger(DatabaseAuditPublisher.name);

  constructor(
    @InjectRepository(AuditEventEntity)
    private readonly repository: Repository<AuditEventEntity>,
  ) {}

  async publishDecision(event: AuditEvent): Promise<void> {
    const row = this.repository.create({
      eventId: event.eventId,
      eventType: event.eventType,
      schemaVersion: event.schemaVersion,
      traceId: event.traceId,
      useCaseId: event.useCaseId,
      tenantId: event.tenantId ?? null,
      userId: event.userId ?? null,
      stage: event.stage,
      riskTier: event.riskTier,
      action: event.action ?? null,
      signals: event.signals ?? null,
      reasons: event.reasons ?? null,
      policyVersion: event.policyVersion ?? null,
      contentHash: event.contentHash ?? null,
      latencyMs: event.latencyMs ?? null,
      metadata: event.metadata ?? null,
      occurredAt: new Date(event.occurredAt),
    });

    // save() keyed on the supplied eventId makes a replayed event idempotent,
    // matching how a Kafka consumer would dedupe on the message key.
    await this.repository.save(row);

    this.logger.debug(`Recorded ${event.eventType} for trace ${event.traceId}`);
  }
}
