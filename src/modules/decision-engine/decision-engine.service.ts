import { Inject, Injectable, Logger } from '@nestjs/common';
import { InspectionContext } from '../../common/interfaces';
import { DetectionResult } from '../detection/interfaces';
import { ResolvedPolicy } from '../policy-config/interfaces/policy.interface';
import { DECISION_RULES, Decision, DecisionRule } from './interfaces';
import { ThresholdResolver } from './threshold.resolver';

/**
 * Turns detection signals into exactly one of allow / edit / escalate / block.
 * The engine is deliberately conservative: the most severe matching rule wins,
 * and an unknown or errored state resolves upward, never downward.
 */
@Injectable()
export class DecisionEngineService {
  private readonly logger = new Logger(DecisionEngineService.name);

  constructor(
    @Inject(DECISION_RULES) private readonly rules: DecisionRule[],
    private readonly thresholdResolver: ThresholdResolver,
  ) {}

  decide(
    _context: InspectionContext,
    _detection: DetectionResult,
    _policy: ResolvedPolicy,
  ): Promise<Decision> {
    // TODO: evaluate all rules, take max severity, build edits for EDIT,
    // and record the reason trail for audit.
    throw new Error('DecisionEngineService.decide not implemented');
  }
}
