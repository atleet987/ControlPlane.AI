import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DetectionType, RiskTier } from '../../common/enums';
import { PolicyConfigEntity } from './entities/policy-config.entity';
import { PolicyThresholds } from './interfaces/policy.interface';

interface SeedPolicy {
  useCaseId: string;
  name: string;
  description: string;
  riskTier: RiskTier;
  slowPathEnabled: boolean;
  thresholds: PolicyThresholds;
}

/**
 * The three demo use-cases, ordered low to high risk. Bands are set so the same
 * signal produces a different tier depending on the use-case — which is the
 * whole point of per-use-case policy: identical content, different consequence.
 */
export const SEED_POLICIES: SeedPolicy[] = [
  {
    useCaseId: 'internal-copilot',
    name: 'Internal engineering copilot',
    description:
      'Staff-facing assistant over internal docs. Lowest risk: the audience is trusted, so PII is redacted rather than escalated and unsupported claims are tolerated.',
    riskTier: RiskTier.LOW,
    slowPathEnabled: false,
    thresholds: {
      [DetectionType.PII]: { enabled: true, editAt: 0.8 },
      [DetectionType.TOXICITY]: { enabled: true, escalateAt: 0.9 },
      [DetectionType.PROMPT_INJECTION]: { enabled: true, escalateAt: 0.85 },
      [DetectionType.ENTAILMENT]: { enabled: true, escalateAt: 0.8 },
      [DetectionType.JUDGE]: { enabled: true, escalateAt: 0.8 },
    },
  },
  {
    useCaseId: 'customer-support',
    name: 'Customer support assistant',
    description:
      'Customer-facing support replies. Redacts PII, escalates unsupported claims, blocks contradicted ones and abusive language.',
    riskTier: RiskTier.MEDIUM,
    slowPathEnabled: true,
    thresholds: {
      [DetectionType.PII]: { enabled: true, editAt: 0.5, escalateAt: 0.99 },
      [DetectionType.TOXICITY]: { enabled: true, escalateAt: 0.7, blockAt: 0.9 },
      [DetectionType.PROMPT_INJECTION]: { enabled: true, escalateAt: 0.6, blockAt: 0.9 },
      [DetectionType.ENTAILMENT]: { enabled: true, escalateAt: 0.4, blockAt: 0.8 },
      [DetectionType.JUDGE]: { enabled: true, escalateAt: 0.4, blockAt: 0.8 },
    },
  },
  {
    useCaseId: 'decision-support',
    name: 'Regulated decision support',
    description:
      'Advice that feeds a regulated decision. Highest risk: any PII exposure escalates to a human, and an unsupported claim is blocked rather than merely flagged.',
    riskTier: RiskTier.CRITICAL,
    slowPathEnabled: true,
    thresholds: {
      [DetectionType.PII]: { enabled: true, editAt: 0.3, escalateAt: 0.6 },
      [DetectionType.TOXICITY]: { enabled: true, escalateAt: 0.5, blockAt: 0.8 },
      [DetectionType.PROMPT_INJECTION]: { enabled: true, escalateAt: 0.4, blockAt: 0.7 },
      [DetectionType.ENTAILMENT]: { enabled: true, escalateAt: 0.3, blockAt: 0.5 },
      [DetectionType.JUDGE]: { enabled: true, escalateAt: 0.3, blockAt: 0.5 },
    },
  },
];

/**
 * Seeds the demo policies on boot.
 *
 * Idempotent by `useCaseId`: an existing policy is left alone, so editing a
 * policy through the API survives a restart. Runs on application bootstrap so
 * the schema is guaranteed to exist first.
 */
@Injectable()
export class PolicySeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PolicySeederService.name);

  constructor(
    @InjectRepository(PolicyConfigEntity)
    private readonly repository: Repository<PolicyConfigEntity>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    let created = 0;

    for (const seed of SEED_POLICIES) {
      const existing = await this.repository.findOne({ where: { useCaseId: seed.useCaseId } });
      if (existing) {
        continue;
      }

      await this.repository.save(
        this.repository.create({
          ...seed,
          version: 1,
          isActive: true,
          createdBy: 'seeder',
        }),
      );
      created += 1;
    }

    this.logger.log(
      created > 0
        ? `Seeded ${created} policy/policies: ${SEED_POLICIES.map((p) => p.useCaseId).join(', ')}`
        : 'Policies already present; nothing seeded.',
    );
  }
}
