import { Injectable } from '@nestjs/common';
import { DecisionAction } from '../../common/enums';
import { DetectionSignal } from '../../common/interfaces';
import { ResolvedPolicy } from '../policy-config/interfaces/policy.interface';

/**
 * Maps a single signal's score onto an action using the policy's per-detector
 * bands. Kept separate from the engine so the banding logic is unit-testable
 * in isolation from rule composition.
 */
@Injectable()
export class ThresholdResolver {
  resolve(_signal: DetectionSignal, _policy: ResolvedPolicy): DecisionAction {
    // TODO: blockAt -> BLOCK, escalateAt -> ESCALATE, editAt -> EDIT, else ALLOW.
    throw new Error('ThresholdResolver.resolve not implemented');
  }

  /** Severity ordering used to merge per-signal actions into one verdict. */
  static severityOf(action: DecisionAction): number {
    switch (action) {
      case DecisionAction.ALLOW:
        return 0;
      case DecisionAction.EDIT:
        return 1;
      case DecisionAction.ESCALATE:
        return 2;
      case DecisionAction.BLOCK:
        return 3;
    }
  }
}
