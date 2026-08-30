/**
 * Risk tier attached to a use-case by its policy config. Drives how aggressive
 * detection is and how conservatively the decision engine resolves signals.
 */
export enum RiskTier {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}
