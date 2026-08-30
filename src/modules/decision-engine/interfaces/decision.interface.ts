import { DecisionAction } from '../../../common/enums';
import { DetectionSignal } from '../../../common/interfaces';

/** A single redaction/rewrite the EDIT action applies before release. */
export interface ContentEdit {
  start: number;
  end: number;
  replacement: string;
  reason: string;
}

export interface Decision {
  traceId: string;
  useCaseId: string;
  action: DecisionAction;
  /** Highest normalised score across the signals that drove the action. */
  score: number;
  /** Human-readable trail: which rule fired, at which threshold, why. */
  reasons: string[];
  /** Only populated for `EDIT`. */
  edits?: ContentEdit[];
  /** The exact signals the action was derived from. */
  triggeringSignals: DetectionSignal[];
  policyVersion: number;
  decidedAt: Date;
  latencyMs: number;
}
