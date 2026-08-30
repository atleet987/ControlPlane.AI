import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DecisionAction, RiskTier } from '../../common/enums';
import { CreatePolicyConfigDto, UpdatePolicyConfigDto } from './dto';
import { PolicyConfigEntity } from './entities/policy-config.entity';
import { ResolvedPolicy } from './interfaces/policy.interface';

@Injectable()
export class PolicyConfigService {
  private readonly logger = new Logger(PolicyConfigService.name);

  constructor(
    @InjectRepository(PolicyConfigEntity)
    private readonly repository: Repository<PolicyConfigEntity>,
  ) {}

  /**
   * Hot path. Resolves the active policy for a use-case; falls back to a
   * conservative default so an unconfigured use-case is never wide open.
   */
  resolve(_useCaseId: string): Promise<ResolvedPolicy> {
    // TODO: read-through Redis cache, then MySQL, then conservative default.
    throw new Error('PolicyConfigService.resolve not implemented');
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

  create(_dto: CreatePolicyConfigDto): Promise<PolicyConfigEntity> {
    // TODO: insert as version 1, or supersede the current active version.
    throw new Error('PolicyConfigService.create not implemented');
  }

  findAll(): Promise<PolicyConfigEntity[]> {
    // TODO: paginated listing of active policies.
    throw new Error('PolicyConfigService.findAll not implemented');
  }

  findOne(_useCaseId: string): Promise<PolicyConfigEntity> {
    // TODO: throw NotFoundException when absent.
    throw new NotFoundException('PolicyConfigService.findOne not implemented');
  }

  update(_useCaseId: string, _dto: UpdatePolicyConfigDto): Promise<PolicyConfigEntity> {
    // TODO: version bump + cache invalidation.
    throw new Error('PolicyConfigService.update not implemented');
  }

  deactivate(_useCaseId: string): Promise<void> {
    // TODO: soft-disable, never hard-delete — policies are audit evidence.
    throw new Error('PolicyConfigService.deactivate not implemented');
  }
}
