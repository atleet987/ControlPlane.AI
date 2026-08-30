import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditController } from './audit.controller';
import { AuditQueryService } from './audit-query.service';
import { AuditService } from './audit.service';
import { AuditEventEntity } from './entities/audit-event.entity';
import { AUDIT_PUBLISHER } from './interfaces/audit-publisher.interface';
import { DatabaseAuditPublisher } from './publishers/database-audit.publisher';

/**
 * The only place that knows which audit transport is in use.
 *
 * Today `AUDIT_PUBLISHER` resolves to `DatabaseAuditPublisher`, which writes to
 * the local `audit_events` table — a placeholder for Kafka during prototype
 * development. Moving to Kafka means providing a `KafkaAuditPublisher` here
 * instead; `AuditService` and every caller stay untouched.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditEventEntity])],
  controllers: [AuditController],
  providers: [
    AuditService,
    AuditQueryService,
    DatabaseAuditPublisher,
    { provide: AUDIT_PUBLISHER, useExisting: DatabaseAuditPublisher },
  ],
  exports: [AuditService, AuditQueryService],
})
export class AuditModule {}
