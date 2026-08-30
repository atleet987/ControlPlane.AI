import { DecisionAction } from '../../../common/enums';
import { DetectionSignal, InspectionContext } from '../../../common/interfaces';
import { ResolvedPolicy } from '../../policy-config/interfaces/policy.interface';

export interface RuleEvaluation {
  matched: boolean;
  action: DecisionAction;
  reason: string;
  score: number;
}

/**
 * Rules are pure functions of (signals, policy, context). Order matters only
 * through `priority`; the engine resolves conflicts by severity, not order.
 */
export interface DecisionRule {
  readonly name: string;
  readonly priority: number;

  evaluate(
    signals: DetectionSignal[],
    policy: ResolvedPolicy,
    context: InspectionContext,
  ): RuleEvaluation;
}

/** DI token for the multi-provider array of decision rules. */
export const DECISION_RULES = Symbol('DECISION_RULES');
