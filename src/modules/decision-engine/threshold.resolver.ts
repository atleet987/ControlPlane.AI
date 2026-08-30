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
  /**
   * Bands are checked most severe first, so overlapping or misordered
   * configuration still fails safe rather than picking the lenient branch.
   * A detector with no configured band, or one explicitly disabled, contributes
   * nothing — absence of configuration is not evidence of safety, it just means
   * this policy does not act on that signal.
   */
  resolve(signal: DetectionSignal, policy: ResolvedPolicy): DecisionAction {
    const threshold = policy.thresholds[signal.type];

    if (!threshold || threshold.enabled === false) {
      return DecisionAction.ALLOW;
    }

    if (threshold.blockAt !== undefined && signal.score >= threshold.blockAt) {
      return DecisionAction.BLOCK;
    }
    if (threshold.escalateAt !== undefined && signal.score >= threshold.escalateAt) {
      return DecisionAction.ESCALATE;
    }
    if (threshold.editAt !== undefined && signal.score >= threshold.editAt) {
      return DecisionAction.EDIT;
    }

    return DecisionAction.ALLOW;
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

  /** Returns whichever action is more severe. */
  static moreSevere(a: DecisionAction, b: DecisionAction): DecisionAction {
    return ThresholdResolver.severityOf(a) >= ThresholdResolver.severityOf(b) ? a : b;
  }
}
