import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Repository } from 'typeorm';
import {
  DecisionAction,
  DetectionPath,
  DetectionType,
  InspectionStage,
  RiskTier,
} from '../src/common/enums';
import { AuditService } from '../src/modules/audit/audit.service';
import { AuditEventEntity } from '../src/modules/audit/entities/audit-event.entity';
import { AuditEventType } from '../src/modules/audit/interfaces/audit-event.interface';

/**
 * Proves the Kafka placeholder actually records events: an emitted decision
 * lands in `audit_events` with the same fields the Kafka envelope carries.
 */
describe('Audit persistence (e2e)', () => {
  let app: INestApplication;
  let auditService: AuditService;
  let repository: Repository<AuditEventEntity>;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'cpai-audit-'));
    process.env.SQLITE_PATH = join(tempDir, 'audit.sqlite');
    process.env.DATABASE_DRIVER = 'sqlite';
    process.env.DATABASE_SYNCHRONIZE = 'true';
    delete process.env.REDIS_URL;

    const { AppModule } = await import('../src/app.module');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    auditService = app.get(AuditService);
    repository = app.get(getRepositoryToken(AuditEventEntity));
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes a decision event with its tier, flags and confidence scores', async () => {
    await auditService.emit({
      eventType: AuditEventType.DECISION_MADE,
      traceId: 'trace-abc',
      useCaseId: 'support-copilot',
      stage: InspectionStage.RESPONSE,
      riskTier: RiskTier.HIGH,
      action: DecisionAction.EDIT,
      reasons: ['pii.EMAIL above editAt'],
      policyVersion: 3,
      contentHash: AuditService.hashContent('hello world'),
      latencyMs: 42,
      signals: [
        {
          type: DetectionType.PII,
          path: DetectionPath.FAST,
          detector: 'regex-pii',
          score: 0.91,
          label: 'EMAIL',
        },
      ],
    });

    const rows = await repository.find({ where: { traceId: 'trace-abc' } });
    expect(rows).toHaveLength(1);

    const row = rows[0];
    expect(row.useCaseId).toBe('support-copilot');
    expect(row.riskTier).toBe(RiskTier.HIGH);
    expect(row.action).toBe(DecisionAction.EDIT);
    expect(row.schemaVersion).toBe(1);
    expect(row.eventId).toEqual(expect.any(String));
    expect(row.signals?.[0].score).toBe(0.91);
    expect(row.signals?.[0].label).toBe('EMAIL');
    expect(row.reasons).toEqual(['pii.EMAIL above editAt']);
    // Content is hashed, never stored.
    expect(row.contentHash).toHaveLength(64);
    expect(row.occurredAt).toBeInstanceOf(Date);
  });

  it('reports the database transport, not kafka', () => {
    expect(auditService.transport).toBe('database');
  });
});
