import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DecisionAction } from '../../common/enums';
import { AuditEventEntity } from './entities/audit-event.entity';

export interface RecentDecision {
  eventId: string;
  traceId: string;
  useCaseId: string;
  riskTier: string;
  action: DecisionAction | null;
  stage: string;
  reasons: string[];
  flags: Array<{ type: string; label?: string; score: number; evidence?: string }>;
  latencyMs: number | null;
  occurredAt: string;
}

export type DecisionCounts = Record<DecisionAction, number> & { total: number };

/**
 * Read side of the audit log.
 *
 * Everything here comes from the persisted `audit_events` rows, not from
 * in-memory state — the point is that the trail survives a restart and would
 * read identically off a Kafka topic replayed into the same table.
 */
@Injectable()
export class AuditQueryService {
  constructor(
    @InjectRepository(AuditEventEntity)
    private readonly repository: Repository<AuditEventEntity>,
  ) {}

  async recent(limit = 10): Promise<RecentDecision[]> {
    const rows = await this.repository.find({
      order: { occurredAt: 'DESC', recordedAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 50),
    });

    return rows.map((row) => ({
      eventId: row.eventId,
      traceId: row.traceId,
      useCaseId: row.useCaseId,
      riskTier: row.riskTier,
      action: row.action,
      stage: row.stage,
      reasons: row.reasons ?? [],
      flags: (row.signals ?? []).map((signal) => ({
        type: signal.type,
        label: signal.label,
        score: signal.score,
        evidence: signal.evidence,
      })),
      latencyMs: row.latencyMs,
      occurredAt:
        row.occurredAt instanceof Date ? row.occurredAt.toISOString() : String(row.occurredAt),
    }));
  }

  /** Tier counts across every persisted decision. */
  async counts(): Promise<DecisionCounts> {
    const rows = await this.repository
      .createQueryBuilder('event')
      .select('event.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .where('event.action IS NOT NULL')
      .groupBy('event.action')
      .getRawMany<{ action: DecisionAction; count: string | number }>();

    const counts = {
      [DecisionAction.ALLOW]: 0,
      [DecisionAction.EDIT]: 0,
      [DecisionAction.ESCALATE]: 0,
      [DecisionAction.BLOCK]: 0,
      total: 0,
    };

    for (const row of rows) {
      const value = Number(row.count);
      if (row.action in counts) {
        counts[row.action] = value;
        counts.total += value;
      }
    }

    return counts;
  }
}
