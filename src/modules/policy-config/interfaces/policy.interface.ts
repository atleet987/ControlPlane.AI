import { DecisionAction, DetectionType, RiskTier } from '../../../common/enums';

/**
 * Per-detector score bands. A signal at or above `blockAt` blocks, at or above
 * `escalateAt` escalates, and so on down. Bands are expected to be ordered
 * `editAt <= escalateAt <= blockAt`; validation of that is the service's job.
 */
export interface DetectorThreshold {
  enabled: boolean;
  editAt?: number;
  escalateAt?: number;
  blockAt?: number;
}

export type PolicyThresholds = Partial<Record<DetectionType, DetectorThreshold>>;

/** Resolved, cache-friendly view of a policy handed to detection and decisioning. */
export interface ResolvedPolicy {
  useCaseId: string;
  version: number;
  riskTier: RiskTier;
  thresholds: PolicyThresholds;
  slowPathEnabled: boolean;
  /** Applied when no detector threshold matches. */
  defaultAction: DecisionAction;
}
