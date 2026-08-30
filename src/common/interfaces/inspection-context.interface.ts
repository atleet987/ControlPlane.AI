import { InspectionStage, RiskTier } from '../enums';

/**
 * The unit of work threaded through detection -> decision -> audit.
 * Built once per gateway call and never mutated in place by detectors.
 */
export interface InspectionContext {
  /** Correlates request, response and all emitted audit events. */
  readonly traceId: string;
  /** Policy lookup key, e.g. `support-copilot`, `catalog-enrichment`. */
  readonly useCaseId: string;
  readonly tenantId?: string;
  readonly userId?: string;
  readonly stage: InspectionStage;
  readonly riskTier: RiskTier;
  /** Text under inspection: the prompt on REQUEST, the completion on RESPONSE. */
  readonly content: string;
  /** Retrieved passages the response is expected to be entailed by. */
  readonly groundingSources?: string[];
  readonly metadata?: Record<string, unknown>;
  readonly receivedAt: Date;
}
