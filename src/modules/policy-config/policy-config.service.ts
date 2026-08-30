import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DecisionAction, RiskTier } from '../../common/enums';
import { RedisService } from '../redis/redis.service';
import { CreatePolicyConfigDto, UpdatePolicyConfigDto } from './dto';
import { PolicyConfigEntity } from './entities/policy-config.entity';
import { ResolvedPolicy } from './interfaces/policy.interface';

const CACHE_TTL_SECONDS = 60;

@Injectable()
export class PolicyConfigService {
  private readonly logger = new Logger(PolicyConfigService.name);

  constructor(
    @InjectRepository(PolicyConfigEntity)
    private readonly repository: Repository<PolicyConfigEntity>,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Hot path. Read-through cache: Redis, then MySQL/SQLite, then a
   * conservative default so an unconfigured use-case is never wide open.
   *
   * Cache failures are swallowed on purpose — Redis is an accelerator, and a
   * cache outage must degrade to a slower database read, not an error.
   */
  async resolve(useCaseId: string): Promise<ResolvedPolicy> {
    const cacheKey = `policy:${useCaseId}`;
    const client = this.redisService.getClient();

    if (client) {
      try {
        const cached = await client.get(cacheKey);
        if (cached) {
          return JSON.parse(cached) as ResolvedPolicy;
        }
      } catch (error) {
        this.logger.warn(
          `Policy cache read failed for ${useCaseId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const entity = await this.repository.findOne({
      where: { useCaseId, isActive: true },
      order: { version: 'DESC' },
    });

    const resolved = entity ? this.toResolved(entity) : this.defaultPolicy(useCaseId);
    if (!entity) {
      this.logger.warn(`No active policy for "${useCaseId}"; applying the conservative default.`);
    }

    if (client) {
      try {
        await client.set(cacheKey, JSON.stringify(resolved), 'EX', CACHE_TTL_SECONDS);
      } catch {
        // Non-fatal: the next call simply reads through again.
      }
    }

    return resolved;
  }

  /** Conservative policy applied when a use-case has no configuration yet. */
  defaultPolicy(useCaseId: string): ResolvedPolicy {
    return {
      useCaseId,
      version: 0,
      riskTier: RiskTier.HIGH,
      thresholds: {},
      slowPathEnabled: true,
      defaultAction: DecisionAction.ESCALATE,
    };
  }

  private toResolved(entity: PolicyConfigEntity): ResolvedPolicy {
    return {
      useCaseId: entity.useCaseId,
      version: entity.version,
      riskTier: entity.riskTier,
      thresholds: entity.thresholds ?? {},
      slowPathEnabled: entity.slowPathEnabled,
      defaultAction:
        entity.riskTier === RiskTier.CRITICAL ? DecisionAction.ESCALATE : DecisionAction.ALLOW,
    };
  }

  private async invalidate(useCaseId: string): Promise<void> {
    const client = this.redisService.getClient();
    if (!client) {
      return;
    }
    try {
      await client.del(`policy:${useCaseId}`);
    } catch {
      // The entry expires on its own within CACHE_TTL_SECONDS.
    }
  }

  async create(dto: CreatePolicyConfigDto): Promise<PolicyConfigEntity> {
    const current = await this.repository.findOne({
      where: { useCaseId: dto.useCaseId },
      order: { version: 'DESC' },
    });

    const entity = this.repository.create({
      ...dto,
      description: dto.description ?? null,
      thresholds: dto.thresholds ?? null,
      slowPathEnabled: dto.slowPathEnabled ?? true,
      version: (current?.version ?? 0) + 1,
      isActive: true,
    });

    const saved = await this.repository.save(entity);
    await this.invalidate(dto.useCaseId);
    return saved;
  }

  findAll(): Promise<PolicyConfigEntity[]> {
    return this.repository.find({
      where: { isActive: true },
      order: { useCaseId: 'ASC', version: 'DESC' },
    });
  }

  async findOne(useCaseId: string): Promise<PolicyConfigEntity> {
    const entity = await this.repository.findOne({
      where: { useCaseId, isActive: true },
      order: { version: 'DESC' },
    });

    if (!entity) {
      throw new NotFoundException(`No active policy for use-case "${useCaseId}"`);
    }
    return entity;
  }

  /**
   * Updates create a new version rather than mutating the current row: a
   * decision already recorded in the audit trail must stay explainable against
   * the exact policy that produced it.
   */
  async update(useCaseId: string, dto: UpdatePolicyConfigDto): Promise<PolicyConfigEntity> {
    const current = await this.findOne(useCaseId);

    const next = this.repository.create({
      ...current,
      ...dto,
      id: undefined,
      version: current.version + 1,
      createdAt: undefined,
      updatedAt: undefined,
    });

    const saved = await this.repository.save(next);
    await this.repository.update({ id: current.id }, { isActive: false });
    await this.invalidate(useCaseId);
    return saved;
  }

  /** Soft-disable, never hard-delete — policies are audit evidence. */
  async deactivate(useCaseId: string): Promise<void> {
    const current = await this.findOne(useCaseId);
    await this.repository.update({ id: current.id }, { isActive: false });
    await this.invalidate(useCaseId);
  }
}
